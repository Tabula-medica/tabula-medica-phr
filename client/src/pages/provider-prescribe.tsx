import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useSEO } from "@/hooks/use-seo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ClipboardPlus,
  User,
  Pill,
  Calendar,
  AlertCircle,
  FileText,
  Store,
  Loader2,
  Check,
  Send,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";
import type { Patient, Pharmacy, PatientPharmacy } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { PageHeader, LoadingState } from "@/components/shared";
import {
  startPhoneSignIn,
  confirmPhoneCode,
  normalizePhoneE164,
  clearRecaptcha,
  getGcipIdToken,
  isGcipConfigured,
  isMfaChallenge,
  getMfaResolver,
  resolveTotpChallenge,
  type ConfirmationResult,
  type MultiFactorResolver,
} from "@/lib/gcip";

const prescriptionFormSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  medicationName: z.string().min(1, "Medication name is required"),
  dosage: z.string().min(1, "Dosage is required"),
  frequency: z.string().min(1, "Frequency is required"),
  route: z.string().min(1, "Route is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  daysSupply: z.coerce.number().min(1, "Days supply must be at least 1"),
  refillsAuthorized: z.coerce.number().min(0, "Refills cannot be negative"),
  instructions: z.string().optional(),
  isControlledSubstance: z.boolean().default(false),
  deaSchedule: z.string().optional(),
  dispenseAsWritten: z.boolean().default(false),
  pharmacyId: z.string().optional(),
  diagnosisCode: z.string().optional(),
  notes: z.string().optional(),
});

type PrescriptionFormData = z.infer<typeof prescriptionFormSchema>;

interface PharmacyWithDetails extends PatientPharmacy {
  pharmacy?: Pharmacy;
}

const commonRoutes = [
  { value: "oral", label: "Oral (by mouth)" },
  { value: "topical", label: "Topical (on skin)" },
  { value: "injection", label: "Injection" },
  { value: "inhalation", label: "Inhalation" },
  { value: "sublingual", label: "Sublingual (under tongue)" },
  { value: "rectal", label: "Rectal" },
  { value: "ophthalmic", label: "Ophthalmic (eye)" },
  { value: "otic", label: "Otic (ear)" },
  { value: "nasal", label: "Nasal" },
  { value: "transdermal", label: "Transdermal (patch)" },
];

const commonFrequencies = [
  { value: "once daily", label: "Once daily" },
  { value: "twice daily", label: "Twice daily (BID)" },
  { value: "three times daily", label: "Three times daily (TID)" },
  { value: "four times daily", label: "Four times daily (QID)" },
  { value: "every 4 hours", label: "Every 4 hours" },
  { value: "every 6 hours", label: "Every 6 hours" },
  { value: "every 8 hours", label: "Every 8 hours" },
  { value: "every 12 hours", label: "Every 12 hours" },
  { value: "as needed", label: "As needed (PRN)" },
  { value: "at bedtime", label: "At bedtime (HS)" },
  { value: "weekly", label: "Weekly" },
];

const deaSchedules = [
  { value: "II", label: "Schedule II" },
  { value: "III", label: "Schedule III" },
  { value: "IV", label: "Schedule IV" },
  { value: "V", label: "Schedule V" },
];

export default function ProviderPrescribePage() {
  useSEO({
    title: "E-Prescribe | Tabula Medica",
    description: "Electronic prescribing for healthcare providers",
  });

  const { patientId } = useParams<{ patientId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: patient, isLoading: patientLoading } = useQuery<Patient>({
    queryKey: ["/api/patients", patientId],
    enabled: !!patientId,
  });

  const { data: patientPharmacies = [] } = useQuery<PharmacyWithDetails[]>({
    queryKey: ["/api/patients", patientId, "pharmacies"],
    enabled: !!patientId,
  });

  const form = useForm<PrescriptionFormData>({
    resolver: zodResolver(prescriptionFormSchema),
    defaultValues: {
      patientId: patientId || "",
      medicationName: "",
      dosage: "",
      frequency: "",
      route: "oral",
      quantity: 30,
      daysSupply: 30,
      refillsAuthorized: 0,
      instructions: "",
      isControlledSubstance: false,
      deaSchedule: undefined,
      dispenseAsWritten: false,
      pharmacyId: undefined,
      diagnosisCode: "",
      notes: "",
    },
  });

  const isControlledSubstance = form.watch("isControlledSubstance");
  const primaryPharmacy = patientPharmacies.find(pp => pp.isPrimary);

  // DEA EPCS step-up re-authentication for controlled-substance prescriptions
  // (see server/auth/step-up.ts). The provider's identity for the
  // prescription itself always comes from the authenticated session — the
  // server ignores/overrides any providerId sent here.
  const [pendingPrescription, setPendingPrescription] = useState<PrescriptionFormData | null>(null);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [stepUpPhase, setStepUpPhase] = useState<"phone" | "code" | "totp">("phone");
  const [stepUpPhone, setStepUpPhone] = useState("");
  const [stepUpCode, setStepUpCode] = useState("");
  const [stepUpTotpCode, setStepUpTotpCode] = useState("");
  const [stepUpConfirmation, setStepUpConfirmation] = useState<ConfirmationResult | null>(null);
  const [stepUpMfaResolver, setStepUpMfaResolver] = useState<MultiFactorResolver | null>(null);
  const [stepUpBusy, setStepUpBusy] = useState(false);
  const [stepUpError, setStepUpError] = useState<string | null>(null);
  const gcipReady = isGcipConfigured();
  const stepUpPhoneE164 = normalizePhoneE164(stepUpPhone);

  useEffect(() => () => clearRecaptcha(), []);

  const STEP_UP_ERROR_REASONS = new Set([
    "missing_token",
    "invalid_token",
    "wrong_user",
    "stale",
    "second_factor_required",
  ]);

  async function postPrescription(data: PrescriptionFormData, stepUpToken?: string) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    };
    if (stepUpToken) headers["X-Step-Up-Token"] = stepUpToken;
    const res = await fetch("/api/prescriptions", {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}) as any);
      const err = new Error(body?.message || "Failed to create prescription.") as Error & { reason?: string };
      err.reason = body?.reason;
      throw err;
    }
    return res.json();
  }

  const resetStepUp = () => {
    clearRecaptcha();
    setStepUpOpen(false);
    setStepUpPhase("phone");
    setStepUpPhone("");
    setStepUpCode("");
    setStepUpTotpCode("");
    setStepUpConfirmation(null);
    setStepUpMfaResolver(null);
    setStepUpError(null);
  };

  const createPrescriptionMutation = useMutation({
    mutationFn: async (vars: { data: PrescriptionFormData; stepUpToken?: string }) =>
      postPrescription(vars.data, vars.stepUpToken),
    onSuccess: () => {
      toast({
        title: "Prescription Created",
        description: "The prescription has been successfully created and sent to the pharmacy.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "prescriptions"] });
      setPendingPrescription(null);
      resetStepUp();
      navigate(`/patients/${patientId}`);
    },
    onError: (error: Error & { reason?: string }) => {
      // A step-up-specific failure means the account/session is fine but the
      // DEA re-verification wasn't accepted — keep the filled-out prescription
      // and let the provider retry the step-up rather than losing their work.
      if (error.reason && STEP_UP_ERROR_REASONS.has(error.reason)) {
        setStepUpBusy(false);
        setStepUpError(error.message);
        setStepUpPhase("phone");
        setStepUpConfirmation(null);
        setStepUpMfaResolver(null);
        setStepUpOpen(true);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to create prescription.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PrescriptionFormData) => {
    if (data.isControlledSubstance) {
      setPendingPrescription(data);
      setStepUpError(null);
      setStepUpOpen(true);
      return;
    }
    createPrescriptionMutation.mutate({ data });
  };

  const finishStepUp = async () => {
    const token = await getGcipIdToken(true);
    if (!token || !pendingPrescription) {
      setStepUpError("Could not complete verification. Please try again.");
      return;
    }
    resetStepUp();
    createPrescriptionMutation.mutate({ data: pendingPrescription, stepUpToken: token });
  };

  const handleStepUpSendCode = async () => {
    if (!stepUpPhoneE164) {
      setStepUpError("Enter a valid mobile number, e.g. (571) 555-0123.");
      return;
    }
    setStepUpError(null);
    setStepUpBusy(true);
    try {
      const result = await startPhoneSignIn(stepUpPhoneE164, "recaptcha-container-prescribe");
      setStepUpConfirmation(result);
      setStepUpPhase("code");
    } catch (e: any) {
      setStepUpError(e?.message || "Couldn't send the code. Please try again.");
    } finally {
      setStepUpBusy(false);
    }
  };

  const handleStepUpVerifyCode = async () => {
    if (!stepUpConfirmation || stepUpCode.length !== 6) return;
    setStepUpError(null);
    setStepUpBusy(true);
    try {
      await confirmPhoneCode(stepUpConfirmation, stepUpCode);
      // No TOTP factor enrolled: this was a bare first-factor sign-in. Submit
      // anyway — the server requires sign_in_second_factor === "totp" and will
      // reject with a clear "enable an authenticator app" message if so.
      await finishStepUp();
    } catch (e: any) {
      if (isMfaChallenge(e)) {
        setStepUpMfaResolver(getMfaResolver(e));
        setStepUpPhase("totp");
        setStepUpBusy(false);
      } else {
        setStepUpError(e?.message || "Couldn't verify the code. Please try again.");
        setStepUpBusy(false);
      }
    }
  };

  const handleStepUpVerifyTotp = async () => {
    if (!stepUpMfaResolver || stepUpTotpCode.length < 6) return;
    setStepUpError(null);
    setStepUpBusy(true);
    try {
      await resolveTotpChallenge(stepUpMfaResolver, stepUpTotpCode);
      await finishStepUp();
    } catch (e: any) {
      setStepUpError(e?.message || "That authenticator code didn't work. Please try again.");
      setStepUpBusy(false);
    }
  };

  if (patientLoading) {
    return <LoadingState message="Loading patient information..." />;
  }

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Patient not found</p>
        <Button variant="outline" onClick={() => navigate("/patients")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Patients
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate(`/patients/${patientId}`)}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <PageHeader
          title="Electronic Prescribing"
          subtitle="Create a new prescription for your patient"
          icon={<ClipboardPlus className="h-6 w-6 text-primary" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Patient Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="font-medium text-lg">{patient.firstName} {patient.lastName}</p>
              <p className="text-sm text-muted-foreground">DOB: {new Date(patient.dateOfBirth).toLocaleDateString()}</p>
              <p className="text-sm text-muted-foreground">MRN: {patient.mrn}</p>
            </div>

            {primaryPharmacy?.pharmacy && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                    <Store className="h-3 w-3" />
                    Primary Pharmacy
                  </p>
                  <p className="font-medium text-sm">{primaryPharmacy.pharmacy.name}</p>
                  <p className="text-xs text-muted-foreground">{primaryPharmacy.pharmacy.address}</p>
                  <p className="text-xs text-muted-foreground">{primaryPharmacy.pharmacy.phone}</p>
                  {primaryPharmacy.pharmacy.supportsElectronicPrescribing && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      <Check className="h-3 w-3 mr-1" />
                      e-Prescribe Ready
                    </Badge>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pill className="h-5 w-5" />
              Prescription Details
            </CardTitle>
            <CardDescription>
              Enter the medication information and prescribing instructions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="medicationName"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Medication Name *</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="e.g., Lisinopril 10mg tablets" 
                            data-testid="input-medication-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dosage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dosage *</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="e.g., 10mg" 
                            data-testid="input-dosage"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="frequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frequency *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-frequency">
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {commonFrequencies.map(freq => (
                              <SelectItem key={freq.value} value={freq.value}>
                                {freq.label}
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
                    name="route"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Route *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-route">
                              <SelectValue placeholder="Select route" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {commonRoutes.map(route => (
                              <SelectItem key={route.value} value={route.value}>
                                {route.label}
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
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity *</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            type="number"
                            min={1}
                            data-testid="input-quantity"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="daysSupply"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Days Supply *</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            type="number"
                            min={1}
                            data-testid="input-days-supply"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="refillsAuthorized"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Refills Authorized</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            type="number"
                            min={0}
                            max={11}
                            data-testid="input-refills"
                          />
                        </FormControl>
                        <FormDescription>Maximum 11 refills for non-controlled</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="instructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Patient Instructions (SIG)</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field}
                          placeholder="e.g., Take one tablet by mouth once daily in the morning"
                          className="resize-none"
                          rows={2}
                          data-testid="textarea-instructions"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                    Controlled Substance & Dispensing
                  </h3>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="isControlledSubstance"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>Controlled Substance</FormLabel>
                            <FormDescription>DEA Schedule II-V</FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-controlled"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {isControlledSubstance && (
                      <FormField
                        control={form.control}
                        name="deaSchedule"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>DEA Schedule *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-dea-schedule">
                                  <SelectValue placeholder="Select schedule" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {deaSchedules.map(schedule => (
                                  <SelectItem key={schedule.value} value={schedule.value}>
                                    {schedule.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="dispenseAsWritten"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>Dispense As Written (DAW)</FormLabel>
                            <FormDescription>No generic substitution</FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-daw"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="pharmacyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <Store className="h-4 w-4" />
                          Send to Pharmacy
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-pharmacy">
                              <SelectValue placeholder="Select pharmacy" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {patientPharmacies.map(pp => (
                              <SelectItem key={pp.pharmacyId} value={pp.pharmacyId}>
                                {pp.pharmacy?.name || pp.pharmacyId}
                                {pp.isPrimary && " (Primary)"}
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
                    name="diagnosisCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <FileText className="h-4 w-4" />
                          Diagnosis Code (ICD-10)
                        </FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            placeholder="e.g., I10 (Hypertension)"
                            data-testid="input-diagnosis-code"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provider Notes (Not visible to pharmacy)</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field}
                          placeholder="Internal notes about this prescription..."
                          className="resize-none"
                          rows={2}
                          data-testid="textarea-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-3 justify-end pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(`/patients/${patientId}`)}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createPrescriptionMutation.isPending}
                    data-testid="button-submit-prescription"
                  >
                    {createPrescriptionMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : isControlledSubstance ? (
                      <ShieldCheck className="h-4 w-4 mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    {isControlledSubstance ? "Verify & Send Prescription" : "Send Prescription"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* DEA EPCS step-up re-authentication, required only for controlled substances */}
      <Dialog open={stepUpOpen} onOpenChange={(open) => { if (!open) resetStepUp(); }}>
        <DialogContent data-testid="dialog-dea-step-up">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Verify your identity to prescribe
            </DialogTitle>
            <DialogDescription>
              DEA rules require a fresh, two-factor identity check before sending a Schedule {form.watch("deaSchedule") || "II-V"} prescription.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {!gcipReady && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Verification is temporarily unavailable. Please try again shortly.</AlertDescription>
              </Alert>
            )}
            {stepUpError && (
              <Alert variant="destructive" data-testid="alert-step-up-error">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{stepUpError}</AlertDescription>
              </Alert>
            )}

            {stepUpPhase === "phone" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="step-up-phone" className="text-sm">Mobile number</Label>
                  <Input
                    id="step-up-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="(571) 555-0123"
                    value={stepUpPhone}
                    onChange={(e) => setStepUpPhone(e.target.value)}
                    data-testid="input-step-up-phone"
                  />
                </div>
                <Button
                  type="button"
                  className="w-full"
                  disabled={stepUpBusy || !gcipReady || !stepUpPhoneE164}
                  onClick={handleStepUpSendCode}
                  data-testid="button-step-up-send-code"
                >
                  {stepUpBusy ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending code...</>
                  ) : (
                    <><MessageSquare className="h-4 w-4 mr-2" /> Text me a code</>
                  )}
                </Button>
              </div>
            )}

            {stepUpPhase === "code" && (
              <div className="space-y-3" data-testid="step-up-code-step">
                <div className="space-y-1.5">
                  <Label htmlFor="step-up-code" className="text-sm">
                    Enter the code we texted to {stepUpPhoneE164}
                  </Label>
                  <Input
                    id="step-up-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    maxLength={6}
                    value={stepUpCode}
                    onChange={(e) => setStepUpCode(e.target.value.replace(/\D/g, ""))}
                    className="text-center text-lg tracking-widest font-mono"
                    data-testid="input-step-up-code"
                  />
                </div>
                <Button
                  type="button"
                  className="w-full"
                  disabled={stepUpBusy || stepUpCode.length !== 6}
                  onClick={handleStepUpVerifyCode}
                  data-testid="button-step-up-verify-code"
                >
                  {stepUpBusy ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying...</>
                  ) : (
                    "Continue"
                  )}
                </Button>
              </div>
            )}

            {stepUpPhase === "totp" && (
              <div className="space-y-3" data-testid="step-up-totp-step">
                <div className="space-y-1.5">
                  <Label htmlFor="step-up-totp" className="text-sm">
                    Enter the 6-digit code from your authenticator app
                  </Label>
                  <Input
                    id="step-up-totp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    maxLength={6}
                    value={stepUpTotpCode}
                    onChange={(e) => setStepUpTotpCode(e.target.value.replace(/\D/g, ""))}
                    className="text-center text-lg tracking-widest font-mono"
                    data-testid="input-step-up-totp"
                  />
                </div>
                <Button
                  type="button"
                  className="w-full"
                  disabled={stepUpBusy || stepUpTotpCode.length < 6}
                  onClick={handleStepUpVerifyTotp}
                  data-testid="button-step-up-verify-totp"
                >
                  {stepUpBusy ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying...</>
                  ) : (
                    <><ShieldCheck className="h-4 w-4 mr-2" /> Verify & Send Prescription</>
                  )}
                </Button>
              </div>
            )}

            {/* Invisible reCAPTCHA target for Firebase phone auth. */}
            <div id="recaptcha-container-prescribe" />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={resetStepUp} disabled={stepUpBusy} data-testid="button-step-up-cancel">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
