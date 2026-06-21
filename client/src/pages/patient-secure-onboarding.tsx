import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  User, Shield, FileText, CheckCircle, ArrowRight, ArrowLeft,
  Upload, Loader2, Lock, Eye, Camera, CreditCard, Heart, AlertTriangle,
  ClipboardCheck, Home, Phone, Mail, MapPin, Calendar, UserCheck
} from "lucide-react";
import { Link } from "wouter";
import { LoadingState } from "@/components/shared";
import type {
  SecureOnboardingSession,
  SecureOnboardingProfile,
  OnboardingDocument,
  OnboardingConsent,
  OnboardingDocType,
  OnboardingConsentType,
} from "@shared/schema";

const SAMPLE_PATIENT_ID = "patient-secure-001";

const STEPS = [
  { id: 0, key: "welcome" as const, label: "Welcome", icon: Heart },
  { id: 1, key: "profile" as const, label: "Profile", icon: User },
  { id: 2, key: "documents" as const, label: "Documents", icon: FileText },
  { id: 3, key: "consents" as const, label: "Agreements", icon: ClipboardCheck },
  { id: 4, key: "complete" as const, label: "Complete", icon: CheckCircle },
];

const DOC_TYPES: { key: OnboardingDocType; label: string; description: string; required: boolean; icon: typeof CreditCard }[] = [
  { key: "government_id", label: "Government-Issued ID", description: "Driver's license, passport, or state ID", required: true, icon: UserCheck },
  { key: "insurance_front", label: "Insurance Card (Front)", description: "Front of your primary insurance card", required: true, icon: CreditCard },
  { key: "insurance_back", label: "Insurance Card (Back)", description: "Back of your primary insurance card", required: false, icon: CreditCard },
  { key: "secondary_insurance_front", label: "Secondary Insurance (Front)", description: "If you have secondary coverage", required: false, icon: CreditCard },
  { key: "secondary_insurance_back", label: "Secondary Insurance (Back)", description: "Back of secondary insurance card", required: false, icon: CreditCard },
];

const CONSENT_ITEMS: { key: OnboardingConsentType; label: string; description: string; required: boolean }[] = [
  { key: "terms_of_service", label: "Terms of Service", description: "By agreeing, you accept our terms governing use of the Tabula Medica platform, including patient responsibilities, service limitations, and dispute resolution procedures.", required: true },
  { key: "privacy_policy", label: "Privacy Policy", description: "This policy describes how we collect, use, and protect your personal and health information. We adhere to strict data minimization principles and never sell your data.", required: true },
  { key: "hipaa_notice", label: "HIPAA Notice of Privacy Practices", description: "This notice explains your rights regarding your Protected Health Information (PHI), how it may be used and disclosed, and how you can access and control it under the Health Insurance Portability and Accountability Act.", required: true },
  { key: "hipaa_ai_disclosure", label: "HIPAA AI Disclosure", description: "I authorize Tabula Medica to use AI to summarize my records. AI-generated summaries are for informational purposes only and do not replace professional medical advice. Your data is processed in compliance with HIPAA regulations.", required: true },
  { key: "fasten_health_authorization", label: "Fasten Health Record Retrieval", description: "I authorize Fasten Health to retrieve my records from my selected hospitals. This allows Tabula Medica to securely import your health records from participating healthcare providers on your behalf.", required: true },
  { key: "data_sharing", label: "Data Sharing Consent", description: "Allow secure sharing of your health records with your care team providers. You can revoke this consent at any time from your privacy settings.", required: false },
  { key: "telehealth_consent", label: "Telehealth Services Consent", description: "Consent to receive telehealth services including video consultations, secure messaging, and remote monitoring through the platform.", required: false },
];

interface SessionData {
  session: SecureOnboardingSession;
  documents: OnboardingDocument[];
  consents: OnboardingConsent[];
}

export default function PatientSecureOnboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const { toast } = useToast();

  const [profile, setProfile] = useState<SecureOnboardingProfile>({
    firstName: "",
    middleName: "NMN",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    phone: "",
    email: "",
    address: { street: "", city: "", state: "", zipCode: "" },
    emergencyContact: { name: "", relationship: "", phone: "" },
    preferredLanguage: "en",
  });

  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [consentChecks, setConsentChecks] = useState<Record<string, boolean>>({});

  const { data: sessionData, isLoading: isLoadingSession } = useQuery<SessionData>({
    queryKey: ["/api/secure-onboarding/session", SAMPLE_PATIENT_ID],
  });

  const saveProfileMutation = useMutation({
    mutationFn: async (profileData: SecureOnboardingProfile) => {
      return apiRequest("POST", `/api/secure-onboarding/session/${SAMPLE_PATIENT_ID}/profile`, profileData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/secure-onboarding/session", SAMPLE_PATIENT_ID] });
      toast({ title: "Profile Saved", description: "Your profile information has been securely saved." });
      setCurrentStep(2);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save profile. Please check all required fields.", variant: "destructive" });
    },
  });

  const confirmDocMutation = useMutation({
    mutationFn: async (data: { docType: string; fileName: string; mimeType: string; objectKey: string }) => {
      return apiRequest("POST", `/api/secure-onboarding/session/${SAMPLE_PATIENT_ID}/document/confirm`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/secure-onboarding/session", SAMPLE_PATIENT_ID] });
      toast({ title: "Document Uploaded", description: "Your document has been securely uploaded and encrypted." });
    },
    onError: () => {
      toast({ title: "Upload Failed", description: "Failed to upload document. Please try again.", variant: "destructive" });
    },
  });

  const submitConsentMutation = useMutation({
    mutationFn: async (data: { consentType: string; agreed: boolean; version: string }) => {
      return apiRequest("POST", `/api/secure-onboarding/session/${SAMPLE_PATIENT_ID}/consent`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/secure-onboarding/session", SAMPLE_PATIENT_ID] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/secure-onboarding/session/${SAMPLE_PATIENT_ID}/complete`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/secure-onboarding/session", SAMPLE_PATIENT_ID] });
      toast({ title: "Onboarding Complete", description: "Welcome to Tabula Medica! Your account is set up." });
      setCurrentStep(4);
    },
    onError: () => {
      toast({ title: "Cannot Complete", description: "Please complete all required steps first.", variant: "destructive" });
    },
  });

  const handleFileUpload = useCallback(async (docType: OnboardingDocType, file: File) => {
    setUploadingDoc(docType);
    try {
      const urlRes = await apiRequest("POST", `/api/secure-onboarding/session/${SAMPLE_PATIENT_ID}/document/upload-url`, {
        docType,
        fileName: file.name,
        contentType: file.type,
      });
      const { uploadURL, objectPath } = await urlRes.json();

      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      await confirmDocMutation.mutateAsync({
        docType,
        fileName: file.name,
        mimeType: file.type,
        objectKey: objectPath,
      });
    } catch {
      toast({ title: "Upload Error", description: "Failed to upload file. Please try again.", variant: "destructive" });
    } finally {
      setUploadingDoc(null);
    }
  }, [confirmDocMutation, toast]);

  const handleConsentToggle = useCallback(async (consentType: OnboardingConsentType, agreed: boolean) => {
    setConsentChecks((prev) => ({ ...prev, [consentType]: agreed }));
    await submitConsentMutation.mutateAsync({ consentType, agreed, version: "1.0" });
  }, [submitConsentMutation]);

  const session = sessionData?.session;
  const uploadedDocs = sessionData?.documents || [];
  const savedConsents = sessionData?.consents || [];

  const completedSteps = session?.completedSteps || [];
  const progressPercent = (completedSteps.length / (STEPS.length - 1)) * 100;

  const getDocForType = (docType: OnboardingDocType) => uploadedDocs.find((d) => d.docType === docType);
  const getConsentForType = (consentType: OnboardingConsentType) => savedConsents.find((c) => c.consentType === consentType && c.agreed);

  const hasRequiredDocs = DOC_TYPES.filter((d) => d.required).every((d) => getDocForType(d.key));
  const hasRequiredConsents = CONSENT_ITEMS.filter((c) => c.required).every((c) => getConsentForType(c.key));

  if (isLoadingSession) {
    return <LoadingState data-testid="loading-onboarding" />;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6" data-testid="secure-onboarding-page">
      <div className="flex items-center gap-3" data-testid="text-page-header">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Secure Patient Onboarding</h1>
          <p className="text-sm text-muted-foreground">All data is encrypted and handled under HIPAA protocols</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium" data-testid="text-progress-percent">{Math.round(progressPercent)}% complete</span>
        </div>
        <Progress value={progressPercent} className="h-2" data-testid="progress-bar" />
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-2" data-testid="step-indicators">
        {STEPS.map((step, idx) => {
          const isActive = currentStep === idx;
          const isCompleted = completedSteps.includes(step.key);
          const StepIcon = step.icon;
          return (
            <button
              key={step.key}
              onClick={() => setCurrentStep(idx)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : isCompleted
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground"
              }`}
              data-testid={`step-button-${step.key}`}
            >
              <StepIcon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{step.label}</span>
              {isCompleted && <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400 shrink-0" />}
            </button>
          );
        })}
      </div>

      {currentStep === 0 && (
        <Card data-testid="step-welcome">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
              Welcome to Tabula Medica
            </CardTitle>
            <CardDescription>Let's get your account set up securely in just a few steps</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6 text-center space-y-2">
                  <User className="h-8 w-8 mx-auto text-blue-600 dark:text-blue-400" />
                  <h3 className="font-semibold">Set Up Profile</h3>
                  <p className="text-sm text-muted-foreground">Enter your personal and contact information</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center space-y-2">
                  <FileText className="h-8 w-8 mx-auto text-green-600 dark:text-green-400" />
                  <h3 className="font-semibold">Upload Documents</h3>
                  <p className="text-sm text-muted-foreground">Securely upload your ID and insurance cards</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center space-y-2">
                  <Shield className="h-8 w-8 mx-auto text-purple-600 dark:text-purple-400" />
                  <h3 className="font-semibold">Review Agreements</h3>
                  <p className="text-sm text-muted-foreground">Accept terms and privacy policies</p>
                </CardContent>
              </Card>
            </div>

            <Alert>
              <Lock className="h-4 w-4" />
              <AlertDescription>
                Your information is protected with AES-256 encryption and stored in compliance with HIPAA regulations. All access is logged for your security.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end">
              <Button onClick={() => setCurrentStep(1)} data-testid="button-start-onboarding">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 1 && (
        <Card data-testid="step-profile">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Profile Information
            </CardTitle>
            <CardDescription>Please provide your personal details. All fields marked with * are required.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                Personal Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={profile.firstName}
                    onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                    placeholder="Enter first name"
                    data-testid="input-first-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="middleName" className="flex items-center gap-2">
                    Middle Name *
                    <span className="text-xs text-muted-foreground">(USCDI required)</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="middleName"
                      value={profile.middleName}
                      onChange={(e) => setProfile({ ...profile, middleName: e.target.value })}
                      placeholder="Full middle name"
                      data-testid="input-middle-name"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant={profile.middleName === "NMN" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setProfile({ ...profile, middleName: "NMN" })}
                      data-testid="button-nmn"
                      title="No Middle Name"
                    >
                      NMN
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter full middle name as on government ID. Use NMN if no middle name.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={profile.lastName}
                    onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                    placeholder="Enter last name"
                    data-testid="input-last-name"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dob">Date of Birth *</Label>
                  <Input
                    id="dob"
                    type="date"
                    value={profile.dateOfBirth}
                    onChange={(e) => setProfile({ ...profile, dateOfBirth: e.target.value })}
                    data-testid="input-dob"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender *</Label>
                  <Select value={profile.gender} onValueChange={(v) => setProfile({ ...profile, gender: v })}>
                    <SelectTrigger data-testid="select-gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="non-binary">Non-binary</SelectItem>
                      <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Contact Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                    data-testid="input-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    placeholder="your@email.com"
                    data-testid="input-email"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Address
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="street">Street Address *</Label>
                  <Input
                    id="street"
                    value={profile.address.street}
                    onChange={(e) => setProfile({ ...profile, address: { ...profile.address, street: e.target.value } })}
                    placeholder="123 Main St"
                    data-testid="input-street"
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={profile.address.city}
                      onChange={(e) => setProfile({ ...profile, address: { ...profile.address, city: e.target.value } })}
                      placeholder="City"
                      data-testid="input-city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State *</Label>
                    <Input
                      id="state"
                      value={profile.address.state}
                      onChange={(e) => setProfile({ ...profile, address: { ...profile.address, state: e.target.value } })}
                      placeholder="State"
                      data-testid="input-state"
                    />
                  </div>
                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <Label htmlFor="zipCode">Zip Code *</Label>
                    <Input
                      id="zipCode"
                      value={profile.address.zipCode}
                      onChange={(e) => setProfile({ ...profile, address: { ...profile.address, zipCode: e.target.value } })}
                      placeholder="12345"
                      data-testid="input-zip"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Emergency Contact
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ecName">Contact Name *</Label>
                  <Input
                    id="ecName"
                    value={profile.emergencyContact.name}
                    onChange={(e) => setProfile({ ...profile, emergencyContact: { ...profile.emergencyContact, name: e.target.value } })}
                    placeholder="Full name"
                    data-testid="input-ec-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ecRelationship">Relationship *</Label>
                  <Select
                    value={profile.emergencyContact.relationship}
                    onValueChange={(v) => setProfile({ ...profile, emergencyContact: { ...profile.emergencyContact, relationship: v } })}
                  >
                    <SelectTrigger data-testid="select-ec-relationship">
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spouse">Spouse</SelectItem>
                      <SelectItem value="parent">Parent</SelectItem>
                      <SelectItem value="sibling">Sibling</SelectItem>
                      <SelectItem value="child">Child</SelectItem>
                      <SelectItem value="friend">Friend</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ecPhone">Contact Phone *</Label>
                  <Input
                    id="ecPhone"
                    type="tel"
                    value={profile.emergencyContact.phone}
                    onChange={(e) => setProfile({ ...profile, emergencyContact: { ...profile.emergencyContact, phone: e.target.value } })}
                    placeholder="(555) 123-4567"
                    data-testid="input-ec-phone"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold">Language Preference</h3>
              <Select value={profile.preferredLanguage} onValueChange={(v) => setProfile({ ...profile, preferredLanguage: v })}>
                <SelectTrigger className="w-48" data-testid="select-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="zh">Chinese</SelectItem>
                  <SelectItem value="ar">Arabic</SelectItem>
                  <SelectItem value="vi">Vietnamese</SelectItem>
                  <SelectItem value="ko">Korean</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentStep(0)} data-testid="button-back-to-welcome">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={() => saveProfileMutation.mutate(profile)}
                disabled={saveProfileMutation.isPending}
                data-testid="button-save-profile"
              >
                {saveProfileMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                Save & Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 2 && (
        <Card data-testid="step-documents">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Identification & Insurance Documents
            </CardTitle>
            <CardDescription>
              Upload clear photos or scans of your documents. Files are encrypted with AES-256 and stored in a HIPAA-compliant vault.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertDescription>
                Documents are encrypted in transit (TLS 1.3) and at rest (AES-256-GCM). Access is restricted to authorized personnel and fully audited.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              {DOC_TYPES.map((docType) => {
                const existing = getDocForType(docType.key);
                const isUploading = uploadingDoc === docType.key;
                const DocIcon = docType.icon;

                return (
                  <Card key={docType.key} data-testid={`doc-upload-${docType.key}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-4 flex-wrap">
                        <div className="flex-shrink-0 p-2 rounded-md bg-muted">
                          <DocIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-[200px]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium">{docType.label}</h4>
                            {docType.required && <Badge variant="secondary">Required</Badge>}
                            {existing && (
                              <Badge variant="outline" className="text-green-700 dark:text-green-400">
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Uploaded
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{docType.description}</p>
                          {existing && (
                            <p className="text-xs text-muted-foreground mt-1">
                              File: {existing.fileName} | Uploaded: {new Date(existing.uploadedAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          <Label htmlFor={`upload-${docType.key}`} className="cursor-pointer">
                            <Button
                              variant={existing ? "outline" : "default"}
                              size="sm"
                              disabled={isUploading}
                              asChild
                              data-testid={`button-upload-${docType.key}`}
                            >
                              <span>
                                {isUploading ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : existing ? (
                                  <Camera className="mr-2 h-4 w-4" />
                                ) : (
                                  <Upload className="mr-2 h-4 w-4" />
                                )}
                                {isUploading ? "Uploading..." : existing ? "Replace" : "Upload"}
                              </span>
                            </Button>
                          </Label>
                          <input
                            id={`upload-${docType.key}`}
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(docType.key, file);
                              e.target.value = "";
                            }}
                            data-testid={`input-file-${docType.key}`}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentStep(1)} data-testid="button-back-to-profile">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={() => setCurrentStep(3)}
                disabled={!hasRequiredDocs}
                data-testid="button-continue-to-consents"
              >
                Continue to Agreements
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 3 && (
        <Card data-testid="step-consents">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Terms & Privacy Agreements
            </CardTitle>
            <CardDescription>
              Please review and accept the required agreements to complete your registration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Eye className="h-4 w-4" />
              <AlertDescription>
                Your consent decisions are timestamped, securely logged, and auditable. You may withdraw optional consents at any time from your privacy settings.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              {CONSENT_ITEMS.map((item) => {
                const existing = getConsentForType(item.key);
                const isChecked = existing?.agreed || consentChecks[item.key] || false;

                return (
                  <Card key={item.key} data-testid={`consent-item-${item.key}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={`consent-${item.key}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => handleConsentToggle(item.key, !!checked)}
                          disabled={submitConsentMutation.isPending}
                          data-testid={`checkbox-consent-${item.key}`}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Label htmlFor={`consent-${item.key}`} className="font-medium cursor-pointer">
                              {item.label}
                            </Label>
                            {item.required && <Badge variant="secondary">Required</Badge>}
                            {isChecked && (
                              <Badge variant="outline" className="text-green-700 dark:text-green-400">
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Agreed
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                          {existing && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Agreed on: {new Date(existing.agreedAt!).toLocaleString()} | Version: {existing.version}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentStep(2)} data-testid="button-back-to-documents">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={() => completeMutation.mutate()}
                disabled={!hasRequiredConsents || completeMutation.isPending}
                data-testid="button-complete-onboarding"
              >
                {completeMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Complete Onboarding
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 4 && (
        <Card data-testid="step-complete">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-4 rounded-full bg-green-100 dark:bg-green-900/30 w-fit">
              <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">Welcome to Tabula Medica</CardTitle>
            <CardDescription>Your account has been set up successfully and securely.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-4 space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Profile Complete
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {session?.profileData ? `${session.profileData.firstName} ${session.profileData.lastName}` : "Profile saved"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Documents Uploaded
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {uploadedDocs.length} document{uploadedDocs.length !== 1 ? "s" : ""} securely stored
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Consents Recorded
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {savedConsents.filter((c) => c.agreed).length} agreement{savedConsents.filter((c) => c.agreed).length !== 1 ? "s" : ""} accepted
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Security Active
                  </h4>
                  <p className="text-sm text-muted-foreground">All actions audited and PHI encrypted</p>
                </CardContent>
              </Card>
            </div>

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                A complete audit trail of your onboarding has been created. You can review it anytime from your security settings.
              </AlertDescription>
            </Alert>

            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link href="/patient-portal">
                <Button data-testid="button-go-to-portal">
                  <Home className="mr-2 h-4 w-4" />
                  Go to Patient Portal
                </Button>
              </Link>
              <Link href="/privacy">
                <Button variant="outline" data-testid="button-go-to-privacy">
                  <Shield className="mr-2 h-4 w-4" />
                  Privacy Settings
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
