import { useState } from "react";
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
} from "lucide-react";
import type { Patient, Pharmacy, PatientPharmacy } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PageHeader, LoadingState } from "@/components/shared";

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

  const createPrescriptionMutation = useMutation({
    mutationFn: async (data: PrescriptionFormData) => {
      return apiRequest("POST", "/api/prescriptions", {
        ...data,
        providerId: "provider-default",
      });
    },
    onSuccess: () => {
      toast({ 
        title: "Prescription Created", 
        description: "The prescription has been successfully created and sent to the pharmacy." 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "prescriptions"] });
      navigate(`/patients/${patientId}`);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create prescription.", 
        variant: "destructive" 
      });
    },
  });

  const onSubmit = (data: PrescriptionFormData) => {
    createPrescriptionMutation.mutate(data);
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
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send Prescription
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
