import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  User, Phone, Mail, MapPin, Shield, Heart, AlertTriangle,
  Calendar, Pill, Activity, FileText, Edit2, Plus, Trash2,
  Check, X, Clock, Building, CreditCard, Stethoscope,
  Bell, Settings, ChevronRight, Syringe, KeyRound, Copy,
  Link2, QrCode, Upload, ShieldCheck, Droplet
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { ObjectUploader } from "@/components/ObjectUploader";
import QRCode from "qrcode";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Demographics {
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  gender: string;
  pronouns?: string;
  preferredName?: string;
  maritalStatus?: string;
  ethnicity?: string;
  race?: string;
  primaryLanguage: string;
  interpreterNeeded?: boolean;
}

interface ContactDetails {
  email: string;
  phone: string;
  alternatePhone?: string;
  address: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  preferredContactMethod: 'email' | 'phone' | 'mail';
  bestTimeToContact?: string;
}

interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  isPrimary: boolean;
  canMakeDecisions: boolean;
  notes?: string;
}

interface InsuranceInfo {
  id: string;
  type: 'primary' | 'secondary' | 'tertiary';
  insurerName: string;
  planName: string;
  memberId: string;
  groupNumber?: string;
  subscriberName: string;
  subscriberDob: string;
  relationshipToSubscriber: string;
  effectiveDate: string;
  terminationDate?: string;
  copay?: number;
  deductible?: number;
  outOfPocketMax?: number;
  coverageStatus: 'active' | 'pending' | 'terminated';
  phoneNumber?: string;
  preAuthRequired?: boolean;
}

interface PatientProfile {
  id: string;
  demographics: Demographics;
  contactDetails: ContactDetails;
  emergencyContacts: EmergencyContact[];
  insuranceInfo: InsuranceInfo[];
  medicalHistory: {
    conditions: Array<{ id: string; name: string; status: string; severity?: string }>;
    medications: Array<{ id: string; name: string; dosage: string; frequency: string; status: string }>;
    allergies: Array<{ id: string; substance: string; reaction: string; severity: string }>;
    procedures: Array<{ id: string; name: string; date: string; status: string; performer?: string }>;
    immunizations: Array<{ id: string; vaccine: string; date: string; status: string }>;
    recentVitals: {
      bloodPressure?: { systolic: number; diastolic: number; date: string };
      heartRate?: { value: number; date: string };
      weight?: { value: number; unit: string; date: string };
      height?: { value: number; unit: string; date: string };
      bmi?: { value: number; date: string };
    };
    upcomingAppointments: Array<{ id: string; type: string; provider: string; date: string; location?: string }>;
  };
  preferences: {
    notificationPreferences: { appointmentReminders: boolean; medicationReminders: boolean; labResults: boolean; marketingCommunications: boolean };
    accessibilitySettings: { fontSize: string; highContrast: boolean; screenReaderOptimized: boolean };
    communicationPreferences: { preferredPharmacy?: string; preferredProvider?: string };
  };
  lastUpdated: string;
  completionPercentage: number;
}

// Emergency Contact & Care Team — optional, patient-chosen contact info.
// Persisted (encrypted at rest) via /api/patient-contacts/:profileId, keyed by
// the real `profiles` row UUID (NOT the legacy patient-profile id).
interface PatientContacts {
  nextOfKin: { name: string; relationship: string; phone: string; email: string };
  pcp: { name: string; phone: string };
  patient: { phone: string; email: string };
}

const EMPTY_CONTACTS: PatientContacts = {
  nextOfKin: { name: "", relationship: "", phone: "", email: "" },
  pcp: { name: "", phone: "" },
  patient: { phone: "", email: "" },
};

interface EmergencyInfo {
  bloodType: string;
  allergiesSummary: string;
  criticalConditions: string;
  latestSummaryText: string;
  pharmacy: { name: string; phone: string; address: string };
  advanceDirective: { hasDirective: boolean; type: string; notes: string; fileKey: string };
  insuranceCard: {
    payer: string;
    memberId: string;
    groupNumber: string;
    frontFileKey: string;
    backFileKey: string;
  };
  consentEmergencySharingAt: string | null;
}

const EMPTY_EMERGENCY: EmergencyInfo = {
  bloodType: "",
  allergiesSummary: "",
  criticalConditions: "",
  latestSummaryText: "",
  pharmacy: { name: "", phone: "", address: "" },
  advanceDirective: { hasDirective: false, type: "", notes: "", fileKey: "" },
  insuranceCard: { payer: "", memberId: "", groupNumber: "", frontFileKey: "", backFileKey: "" },
  consentEmergencySharingAt: null,
};

interface EmergencyTokenInfo {
  id: string;
  label: string;
  expiresAt: string;
  hasPin: boolean;
  createdAt: string | null;
}

interface GeneratedToken {
  id: string;
  token: string;
  shareUrl: string;
  expiresAt: string;
  hasPin: boolean;
  label: string;
}

import { getInitials } from "@/components/shared";
import { formatDate, formatDateTime } from "@/components/shared/format-helpers";

export default function ComprehensivePatientProfile() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const patientId = "patient-1";
  
  const [activeTab, setActiveTab] = useState("overview");
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editedDemographics, setEditedDemographics] = useState<Demographics | null>(null);
  const [editedContact, setEditedContact] = useState<ContactDetails | null>(null);
  const [showEmergencyContactDialog, setShowEmergencyContactDialog] = useState(false);
  const [editingEmergencyContact, setEditingEmergencyContact] = useState<EmergencyContact | null>(null);
  const [showInsuranceDialog, setShowInsuranceDialog] = useState(false);
  const [editingInsurance, setEditingInsurance] = useState<InsuranceInfo | null>(null);

  const { data: profile, isLoading } = useQuery<PatientProfile>({
    queryKey: ["/api/patient-profile/profile", patientId],
  });

  const updateDemographicsMutation = useMutation({
    mutationFn: async (data: Partial<Demographics>) => {
      const res = await apiRequest("PATCH", `/api/patient-profile/profile/${patientId}/demographics`, data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/patient-profile/profile", patientId] });
      setEditingSection(null);
      setEditedDemographics(null);
      toast({ title: "Demographics updated", description: "Your information has been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update demographics.", variant: "destructive" });
    }
  });

  const updateContactMutation = useMutation({
    mutationFn: async (data: Partial<ContactDetails>) => {
      const res = await apiRequest("PATCH", `/api/patient-profile/profile/${patientId}/contact`, data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/patient-profile/profile", patientId] });
      setEditingSection(null);
      setEditedContact(null);
      toast({ title: "Contact details updated", description: "Your contact information has been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update contact details.", variant: "destructive" });
    }
  });

  const addEmergencyContactMutation = useMutation({
    mutationFn: async (data: Omit<EmergencyContact, 'id'>) => {
      const res = await apiRequest("POST", `/api/patient-profile/profile/${patientId}/emergency-contacts`, data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/patient-profile/profile", patientId] });
      setShowEmergencyContactDialog(false);
      setEditingEmergencyContact(null);
      toast({ title: "Emergency contact added", description: "New emergency contact has been saved." });
    }
  });

  const updateEmergencyContactMutation = useMutation({
    mutationFn: async ({ contactId, data }: { contactId: string; data: Partial<EmergencyContact> }) => {
      const res = await apiRequest("PATCH", `/api/patient-profile/profile/${patientId}/emergency-contacts/${contactId}`, data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/patient-profile/profile", patientId] });
      setShowEmergencyContactDialog(false);
      setEditingEmergencyContact(null);
      toast({ title: "Emergency contact updated" });
    }
  });

  const deleteEmergencyContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const res = await apiRequest("DELETE", `/api/patient-profile/profile/${patientId}/emergency-contacts/${contactId}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/patient-profile/profile", patientId] });
      toast({ title: "Emergency contact removed" });
    }
  });

  const addInsuranceMutation = useMutation({
    mutationFn: async (data: Omit<InsuranceInfo, 'id'>) => {
      const res = await apiRequest("POST", `/api/patient-profile/profile/${patientId}/insurance`, data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/patient-profile/profile", patientId] });
      setShowInsuranceDialog(false);
      setEditingInsurance(null);
      toast({ title: "Insurance added" });
    }
  });

  const updateInsuranceMutation = useMutation({
    mutationFn: async ({ insuranceId, data }: { insuranceId: string; data: Partial<InsuranceInfo> }) => {
      const res = await apiRequest("PATCH", `/api/patient-profile/profile/${patientId}/insurance/${insuranceId}`, data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/patient-profile/profile", patientId] });
      setShowInsuranceDialog(false);
      setEditingInsurance(null);
      toast({ title: "Insurance updated" });
    }
  });

  const deleteInsuranceMutation = useMutation({
    mutationFn: async (insuranceId: string) => {
      const res = await apiRequest("DELETE", `/api/patient-profile/profile/${patientId}/insurance/${insuranceId}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/patient-profile/profile", patientId] });
      toast({ title: "Insurance removed" });
    }
  });

  // ---- Emergency Contact & Care Team --------------------------------------
  // These optional fields persist to /api/patient-contacts/:profileId, which is
  // keyed by the REAL `profiles` row UUID from the active profile (NOT patientId,
  // which belongs to the separate /api/patient-profile demo store).
  const { data: activeProfile } = useQuery<{ id: string }>({
    queryKey: ["/api/profiles/active"],
  });
  const contactsProfileId = activeProfile?.id;
  const [contacts, setContacts] = useState<PatientContacts>(EMPTY_CONTACTS);

  const contactsQuery = useQuery<{ contacts: PatientContacts }>({
    queryKey: ["/api/patient-contacts", contactsProfileId],
    enabled: !!contactsProfileId,
  });

  useEffect(() => {
    if (contactsQuery.data?.contacts) {
      setContacts({ ...EMPTY_CONTACTS, ...contactsQuery.data.contacts });
    }
  }, [contactsQuery.data]);

  const saveContactsMutation = useMutation({
    mutationFn: async (payload: PatientContacts) => {
      const res = await apiRequest("PUT", `/api/patient-contacts/${contactsProfileId}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-contacts", contactsProfileId] });
      toast({ title: "Contacts saved", description: "Your emergency contact & care team details were updated." });
    },
    onError: (err: any) => {
      toast({ title: "Could not save contacts", description: err?.message ?? "Please try again.", variant: "destructive" });
    }
  });

  const updateContact = <S extends keyof PatientContacts, F extends keyof PatientContacts[S]>(
    section: S,
    field: F,
    value: string,
  ) => {
    setContacts((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
  };

  // ---- Emergency Info & Break-Glass Sharing -------------------------------
  const [emergency, setEmergency] = useState<EmergencyInfo>(EMPTY_EMERGENCY);
  const [tokenLabel, setTokenLabel] = useState("");
  const [tokenPin, setTokenPin] = useState("");
  const [tokenExpiry, setTokenExpiry] = useState("72");
  const [generatedToken, setGeneratedToken] = useState<GeneratedToken | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const emergencyQuery = useQuery<{ emergency: EmergencyInfo; tokens: EmergencyTokenInfo[] }>({
    queryKey: ["/api/patient-contacts", contactsProfileId, "emergency"],
    enabled: !!contactsProfileId,
  });

  useEffect(() => {
    if (emergencyQuery.data?.emergency) {
      setEmergency({ ...EMPTY_EMERGENCY, ...emergencyQuery.data.emergency });
    }
  }, [emergencyQuery.data]);

  const emergencyConsent = !!emergency.consentEmergencySharingAt;
  const activeTokens = emergencyQuery.data?.tokens ?? [];

  const saveEmergencyMutation = useMutation({
    mutationFn: async (payload: EmergencyInfo) => {
      const body = {
        bloodType: payload.bloodType,
        allergiesSummary: payload.allergiesSummary,
        criticalConditions: payload.criticalConditions,
        latestSummaryText: payload.latestSummaryText,
        pharmacy: payload.pharmacy,
        advanceDirective: payload.advanceDirective,
        insuranceCard: payload.insuranceCard,
        consentEmergencySharing: !!payload.consentEmergencySharingAt,
      };
      const res = await apiRequest("PUT", `/api/patient-contacts/${contactsProfileId}/emergency`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-contacts", contactsProfileId, "emergency"] });
      toast({ title: "Emergency info saved", description: "Your emergency information was updated." });
    },
    onError: (err: any) => {
      toast({ title: "Could not save", description: err?.message ?? "Please try again.", variant: "destructive" });
    },
  });

  const generateTokenMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/patient-contacts/${contactsProfileId}/emergency-token`, {
        label: tokenLabel || undefined,
        expiresInHours: Number(tokenExpiry) || 72,
        pin: tokenPin || undefined,
      });
      return res.json() as Promise<GeneratedToken>;
    },
    onSuccess: async (data) => {
      setGeneratedToken(data);
      const absoluteUrl = `${window.location.origin}${data.shareUrl}`;
      try {
        const url = await QRCode.toDataURL(absoluteUrl, { width: 220, margin: 1 });
        setQrDataUrl(url);
      } catch {
        setQrDataUrl("");
      }
      setTokenPin("");
      setTokenLabel("");
      queryClient.invalidateQueries({ queryKey: ["/api/patient-contacts", contactsProfileId, "emergency"] });
      toast({ title: "Share created", description: "Copy the link or scan the QR. It is shown only once." });
    },
    onError: (err: any) => {
      const msg = String(err?.message ?? "");
      toast({
        title: "Could not create share",
        description: msg.includes("CONSENT_REQUIRED") || msg.includes("409")
          ? "Enable the emergency-sharing consent toggle and save first."
          : msg || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const revokeTokenMutation = useMutation({
    mutationFn: async (tokenId: string) => {
      const res = await apiRequest("POST", `/api/patient-contacts/${contactsProfileId}/emergency-token/${tokenId}/revoke`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-contacts", contactsProfileId, "emergency"] });
      toast({ title: "Share revoked", description: "That link can no longer be used." });
    },
    onError: (err: any) => {
      toast({ title: "Could not revoke", description: err?.message ?? "Please try again.", variant: "destructive" });
    },
  });

  // Build upload handlers for an emergency file slot. Returns a presigned PUT
  // URL from the server and stores the resulting object key into local state.
  const makeUploadHandlers = (applyKey: (objectPath: string) => void) => {
    let pendingPath = "";
    return {
      onGetUploadParameters: async () => {
        const res = await apiRequest("POST", `/api/patient-contacts/${contactsProfileId}/emergency/upload-url`, {});
        const j = await res.json();
        pendingPath = j.objectPath as string;
        return { method: "PUT" as const, url: j.uploadURL as string };
      },
      onComplete: () => {
        if (pendingPath) {
          applyKey(pendingPath);
          toast({ title: "File uploaded", description: "Click Save to attach it to your emergency info." });
        }
      },
    };
  };

  const advanceDirectiveUpload = makeUploadHandlers((key) =>
    setEmergency((prev) => ({ ...prev, advanceDirective: { ...prev.advanceDirective, fileKey: key } })),
  );
  const insuranceFrontUpload = makeUploadHandlers((key) =>
    setEmergency((prev) => ({ ...prev, insuranceCard: { ...prev.insuranceCard, frontFileKey: key } })),
  );
  const insuranceBackUpload = makeUploadHandlers((key) =>
    setEmergency((prev) => ({ ...prev, insuranceCard: { ...prev.insuranceCard, backFileKey: key } })),
  );

  const copyShareLink = (token: GeneratedToken) => {
    const absoluteUrl = `${window.location.origin}${token.shareUrl}`;
    navigator.clipboard?.writeText(absoluteUrl).then(
      () => toast({ title: "Copied", description: "Share link copied to clipboard." }),
      () => toast({ title: "Copy failed", description: absoluteUrl, variant: "destructive" }),
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-32 bg-muted rounded"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Profile not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const startEditDemographics = () => {
    setEditedDemographics({ ...profile.demographics });
    setEditingSection("demographics");
  };

  const startEditContact = () => {
    setEditedContact({ ...profile.contactDetails });
    setEditingSection("contact");
  };

  const saveDemographics = () => {
    if (editedDemographics) {
      updateDemographicsMutation.mutate(editedDemographics);
    }
  };

  const saveContact = () => {
    if (editedContact) {
      updateContactMutation.mutate(editedContact);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16 border-2 border-primary/20">
            <AvatarFallback className="text-xl bg-gradient-to-br from-primary/20 to-primary/10">
              {getInitials(profile.demographics.firstName, profile.demographics.lastName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">
              {profile.demographics.preferredName || profile.demographics.firstName} {profile.demographics.lastName}
            </h1>
            <p className="text-muted-foreground">Patient Profile</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Profile Completion</span>
            <Progress value={profile.completionPercentage} className="w-24" />
            <span className="text-sm font-medium">{profile.completionPercentage}%</span>
          </div>
          <Badge variant="outline" className="text-xs">
            Last updated: {formatDate(profile.lastUpdated)}
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-6 w-full">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="demographics" data-testid="tab-demographics">Demographics</TabsTrigger>
          <TabsTrigger value="contact" data-testid="tab-contact">Contact</TabsTrigger>
          <TabsTrigger value="emergency" data-testid="tab-emergency">Emergency</TabsTrigger>
          <TabsTrigger value="insurance" data-testid="tab-insurance">Insurance</TabsTrigger>
          <TabsTrigger value="medical" data-testid="tab-medical">Medical History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("demographics")}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    Personal Info
                  </CardTitle>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">DOB:</span> {formatDate(profile.demographics.dateOfBirth)}</p>
                <p><span className="text-muted-foreground">Gender:</span> {profile.demographics.gender}</p>
                <p><span className="text-muted-foreground">Language:</span> {profile.demographics.primaryLanguage}</p>
              </CardContent>
            </Card>

            <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("contact")}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Phone className="w-4 h-4 text-primary" />
                    Contact Details
                  </CardTitle>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="flex items-center gap-2"><Mail className="w-3 h-3" /> {profile.contactDetails.email}</p>
                <p className="flex items-center gap-2"><Phone className="w-3 h-3" /> {profile.contactDetails.phone}</p>
                <p className="flex items-center gap-2"><MapPin className="w-3 h-3" /> {profile.contactDetails.address.city}, {profile.contactDetails.address.state}</p>
              </CardContent>
            </Card>

            <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("emergency")}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    Emergency Contacts
                  </CardTitle>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {profile.emergencyContacts.slice(0, 2).map(contact => (
                  <div key={contact.id} className="flex items-center justify-between">
                    <span>{contact.name}</span>
                    {contact.isPrimary && <Badge variant="secondary" className="text-xs">Primary</Badge>}
                  </div>
                ))}
                {profile.emergencyContacts.length === 0 && <p className="text-muted-foreground">No emergency contacts</p>}
              </CardContent>
            </Card>

            <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("insurance")}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-primary" />
                    Insurance
                  </CardTitle>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {profile.insuranceInfo.slice(0, 2).map(ins => (
                  <div key={ins.id} className="flex items-center justify-between">
                    <span>{ins.insurerName}</span>
                    <Badge variant={ins.coverageStatus === 'active' ? 'default' : 'secondary'} className="text-xs capitalize">
                      {ins.type}
                    </Badge>
                  </div>
                ))}
                {profile.insuranceInfo.length === 0 && <p className="text-muted-foreground">No insurance on file</p>}
              </CardContent>
            </Card>

            <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("medical")}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    Health Summary
                  </CardTitle>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Active Conditions</span>
                  <Badge variant="secondary">{profile.medicalHistory.conditions.filter(c => c.status === 'active').length}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Medications</span>
                  <Badge variant="secondary">{profile.medicalHistory.medications.filter(m => m.status === 'active').length}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Allergies</span>
                  <Badge variant="destructive">{profile.medicalHistory.allergies.length}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Upcoming Appointments
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {profile.medicalHistory.upcomingAppointments.slice(0, 2).map(appt => (
                  <div key={appt.id} className="flex items-center justify-between">
                    <span>{appt.type}</span>
                    <span className="text-muted-foreground text-xs">{formatDateTime(appt.date)}</span>
                  </div>
                ))}
                {profile.medicalHistory.upcomingAppointments.length === 0 && <p className="text-muted-foreground">No upcoming appointments</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="demographics" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Demographics
                </CardTitle>
                <CardDescription>Your personal information</CardDescription>
              </div>
              {editingSection !== "demographics" ? (
                <Button variant="outline" size="sm" onClick={startEditDemographics} data-testid="button-edit-demographics">
                  <Edit2 className="w-4 h-4 mr-2" /> Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setEditingSection(null); setEditedDemographics(null); }}>
                    <X className="w-4 h-4 mr-2" /> Cancel
                  </Button>
                  <Button size="sm" onClick={saveDemographics} disabled={updateDemographicsMutation.isPending} data-testid="button-save-demographics">
                    <Check className="w-4 h-4 mr-2" /> Save
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {editingSection === "demographics" && editedDemographics ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" value={editedDemographics.firstName} onChange={(e) => setEditedDemographics({ ...editedDemographics, firstName: e.target.value })} data-testid="input-first-name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="middleName">Middle Name <span className="text-muted-foreground text-xs font-normal">(enter NMN if none)</span></Label>
                    <Input id="middleName" value={editedDemographics.middleName || 'NMN'} onChange={(e) => setEditedDemographics({ ...editedDemographics, middleName: e.target.value || 'NMN' })} placeholder="NMN" data-testid="input-middle-name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" value={editedDemographics.lastName} onChange={(e) => setEditedDemographics({ ...editedDemographics, lastName: e.target.value })} data-testid="input-last-name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="preferredName">Preferred Name</Label>
                    <Input id="preferredName" value={editedDemographics.preferredName || ''} onChange={(e) => setEditedDemographics({ ...editedDemographics, preferredName: e.target.value })} data-testid="input-preferred-name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input id="dob" type="date" value={editedDemographics.dateOfBirth} onChange={(e) => setEditedDemographics({ ...editedDemographics, dateOfBirth: e.target.value })} data-testid="input-dob" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select value={editedDemographics.gender} onValueChange={(value) => setEditedDemographics({ ...editedDemographics, gender: value })}>
                      <SelectTrigger id="gender" data-testid="select-gender"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="non-binary">Non-binary</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                        <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pronouns">Pronouns</Label>
                    <Input id="pronouns" value={editedDemographics.pronouns || ''} onChange={(e) => setEditedDemographics({ ...editedDemographics, pronouns: e.target.value })} placeholder="e.g., she/her, he/him" data-testid="input-pronouns" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maritalStatus">Marital Status</Label>
                    <Select value={editedDemographics.maritalStatus || ''} onValueChange={(value) => setEditedDemographics({ ...editedDemographics, maritalStatus: value })}>
                      <SelectTrigger id="maritalStatus" data-testid="select-marital-status"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single</SelectItem>
                        <SelectItem value="married">Married</SelectItem>
                        <SelectItem value="divorced">Divorced</SelectItem>
                        <SelectItem value="widowed">Widowed</SelectItem>
                        <SelectItem value="separated">Separated</SelectItem>
                        <SelectItem value="domestic_partner">Domestic Partner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="language">Primary Language</Label>
                    <Select value={editedDemographics.primaryLanguage} onValueChange={(value) => setEditedDemographics({ ...editedDemographics, primaryLanguage: value })}>
                      <SelectTrigger id="language" data-testid="select-language"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="English">English</SelectItem>
                        <SelectItem value="Spanish">Spanish</SelectItem>
                        <SelectItem value="Mandarin">Mandarin</SelectItem>
                        <SelectItem value="French">French</SelectItem>
                        <SelectItem value="Vietnamese">Vietnamese</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div><p className="text-sm text-muted-foreground">Full Name</p><p className="font-medium">{profile.demographics.firstName} {profile.demographics.middleName || 'NMN'} {profile.demographics.lastName}</p></div>
                  <div><p className="text-sm text-muted-foreground">Preferred Name</p><p className="font-medium">{profile.demographics.preferredName || '-'}</p></div>
                  <div><p className="text-sm text-muted-foreground">Date of Birth</p><p className="font-medium">{formatDate(profile.demographics.dateOfBirth)}</p></div>
                  <div><p className="text-sm text-muted-foreground">Gender</p><p className="font-medium capitalize">{profile.demographics.gender}</p></div>
                  <div><p className="text-sm text-muted-foreground">Pronouns</p><p className="font-medium">{profile.demographics.pronouns || '-'}</p></div>
                  <div><p className="text-sm text-muted-foreground">Marital Status</p><p className="font-medium capitalize">{profile.demographics.maritalStatus || '-'}</p></div>
                  <div><p className="text-sm text-muted-foreground">Primary Language</p><p className="font-medium">{profile.demographics.primaryLanguage}</p></div>
                  <div><p className="text-sm text-muted-foreground">Interpreter Needed</p><p className="font-medium">{profile.demographics.interpreterNeeded ? 'Yes' : 'No'}</p></div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="w-5 h-5 text-primary" />
                  Contact Details
                </CardTitle>
                <CardDescription>How to reach you</CardDescription>
              </div>
              {editingSection !== "contact" ? (
                <Button variant="outline" size="sm" onClick={startEditContact} data-testid="button-edit-contact">
                  <Edit2 className="w-4 h-4 mr-2" /> Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setEditingSection(null); setEditedContact(null); }}>
                    <X className="w-4 h-4 mr-2" /> Cancel
                  </Button>
                  <Button size="sm" onClick={saveContact} disabled={updateContactMutation.isPending} data-testid="button-save-contact">
                    <Check className="w-4 h-4 mr-2" /> Save
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {editingSection === "contact" && editedContact ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={editedContact.email} onChange={(e) => setEditedContact({ ...editedContact, email: e.target.value })} data-testid="input-email" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" type="tel" value={editedContact.phone} onChange={(e) => setEditedContact({ ...editedContact, phone: e.target.value })} data-testid="input-phone" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="altPhone">Alternate Phone</Label>
                      <Input id="altPhone" type="tel" value={editedContact.alternatePhone || ''} onChange={(e) => setEditedContact({ ...editedContact, alternatePhone: e.target.value })} data-testid="input-alt-phone" />
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="street1">Street Address</Label>
                      <Input id="street1" value={editedContact.address.street1} onChange={(e) => setEditedContact({ ...editedContact, address: { ...editedContact.address, street1: e.target.value } })} data-testid="input-street1" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="street2">Apt/Suite/Unit</Label>
                      <Input id="street2" value={editedContact.address.street2 || ''} onChange={(e) => setEditedContact({ ...editedContact, address: { ...editedContact.address, street2: e.target.value } })} data-testid="input-street2" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input id="city" value={editedContact.address.city} onChange={(e) => setEditedContact({ ...editedContact, address: { ...editedContact.address, city: e.target.value } })} data-testid="input-city" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input id="state" value={editedContact.address.state} onChange={(e) => setEditedContact({ ...editedContact, address: { ...editedContact.address, state: e.target.value } })} data-testid="input-state" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zip">Zip Code</Label>
                      <Input id="zip" value={editedContact.address.zipCode} onChange={(e) => setEditedContact({ ...editedContact, address: { ...editedContact.address, zipCode: e.target.value } })} data-testid="input-zip" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Input id="country" value={editedContact.address.country} onChange={(e) => setEditedContact({ ...editedContact, address: { ...editedContact.address, country: e.target.value } })} data-testid="input-country" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div><p className="text-sm text-muted-foreground">Email</p><p className="font-medium">{profile.contactDetails.email}</p></div>
                    <div><p className="text-sm text-muted-foreground">Phone</p><p className="font-medium">{profile.contactDetails.phone}</p></div>
                    <div><p className="text-sm text-muted-foreground">Alternate Phone</p><p className="font-medium">{profile.contactDetails.alternatePhone || '-'}</p></div>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Address</p>
                    <p className="font-medium">{profile.contactDetails.address.street1}</p>
                    {profile.contactDetails.address.street2 && <p className="font-medium">{profile.contactDetails.address.street2}</p>}
                    <p className="font-medium">{profile.contactDetails.address.city}, {profile.contactDetails.address.state} {profile.contactDetails.address.zipCode}</p>
                    <p className="font-medium">{profile.contactDetails.address.country}</p>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><p className="text-sm text-muted-foreground">Preferred Contact Method</p><p className="font-medium capitalize">{profile.contactDetails.preferredContactMethod}</p></div>
                    <div><p className="text-sm text-muted-foreground">Best Time to Contact</p><p className="font-medium">{profile.contactDetails.bestTimeToContact || '-'}</p></div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-primary" />
                Preferred Contact Info
              </CardTitle>
              <CardDescription>
                Optional — you choose what to share. This helps your care team reach someone in an emergency and lets providers contact you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contacts-patient-phone">Phone</Label>
                  <Input
                    id="contacts-patient-phone"
                    type="tel"
                    value={contacts.patient.phone}
                    onChange={(e) => updateContact("patient", "phone", e.target.value)}
                    placeholder="e.g., (555) 222-3333"
                    maxLength={200}
                    data-testid="input-contacts-patient-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contacts-patient-email">Email</Label>
                  <Input
                    id="contacts-patient-email"
                    type="email"
                    value={contacts.patient.email}
                    onChange={(e) => updateContact("patient", "email", e.target.value)}
                    placeholder="e.g., you@example.com"
                    maxLength={200}
                    data-testid="input-contacts-patient-email"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-primary" />
                Primary Care Provider
              </CardTitle>
              <CardDescription>Your primary care doctor.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pcp-name">Doctor Name</Label>
                  <Input
                    id="pcp-name"
                    value={contacts.pcp.name}
                    onChange={(e) => updateContact("pcp", "name", e.target.value)}
                    placeholder="e.g., Dr. Smith"
                    maxLength={200}
                    data-testid="input-pcp-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pcp-phone">Phone</Label>
                  <Input
                    id="pcp-phone"
                    type="tel"
                    value={contacts.pcp.phone}
                    onChange={(e) => updateContact("pcp", "phone", e.target.value)}
                    placeholder="e.g., (555) 765-4321"
                    maxLength={200}
                    data-testid="input-pcp-phone"
                  />
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button
                  onClick={() => saveContactsMutation.mutate(contacts)}
                  disabled={saveContactsMutation.isPending || contactsQuery.isLoading || !contactsProfileId}
                  data-testid="button-save-contacts-contact"
                >
                  <Check className="w-4 h-4 mr-2" />
                  {saveContactsMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="emergency" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  Emergency Contacts
                </CardTitle>
                <CardDescription>Who to contact in case of emergency</CardDescription>
              </div>
              <Button size="sm" onClick={() => { setEditingEmergencyContact(null); setShowEmergencyContactDialog(true); }} data-testid="button-add-emergency-contact">
                <Plus className="w-4 h-4 mr-2" /> Add Contact
              </Button>
            </CardHeader>
            <CardContent>
              {profile.emergencyContacts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No emergency contacts added</p>
                  <p className="text-sm">Add at least one emergency contact for your safety</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {profile.emergencyContacts.map(contact => (
                    <div key={contact.id} className="flex items-start justify-between p-4 border rounded-lg hover-elevate">
                      <div className="flex items-start gap-4">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback>{contact.name.split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{contact.name}</p>
                            {contact.isPrimary && <Badge variant="default" className="text-xs">Primary</Badge>}
                            {contact.canMakeDecisions && <Badge variant="secondary" className="text-xs">Decision Maker</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">{contact.relationship}</p>
                          <div className="flex flex-wrap gap-4 mt-2 text-sm">
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {contact.phone}</span>
                            {contact.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {contact.email}</span>}
                          </div>
                          {contact.notes && <p className="text-sm text-muted-foreground mt-1">{contact.notes}</p>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingEmergencyContact(contact); setShowEmergencyContactDialog(true); }} data-testid={`button-edit-emergency-${contact.id}`}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteEmergencyContactMutation.mutate(contact.id)} data-testid={`button-delete-emergency-${contact.id}`}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-primary" />
                Next of Kin
              </CardTitle>
              <CardDescription>
                Optional — you choose what to share. This helps your care team reach someone in an emergency and lets providers contact you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nok-name">Name</Label>
                  <Input
                    id="nok-name"
                    value={contacts.nextOfKin.name}
                    onChange={(e) => updateContact("nextOfKin", "name", e.target.value)}
                    placeholder="e.g., Jane Doe"
                    maxLength={200}
                    data-testid="input-nok-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nok-relationship">Relationship</Label>
                  <Input
                    id="nok-relationship"
                    value={contacts.nextOfKin.relationship}
                    onChange={(e) => updateContact("nextOfKin", "relationship", e.target.value)}
                    placeholder="e.g., Spouse, Parent"
                    maxLength={200}
                    data-testid="input-nok-relationship"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nok-phone">Phone</Label>
                  <Input
                    id="nok-phone"
                    type="tel"
                    value={contacts.nextOfKin.phone}
                    onChange={(e) => updateContact("nextOfKin", "phone", e.target.value)}
                    placeholder="e.g., (555) 123-4567"
                    maxLength={200}
                    data-testid="input-nok-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nok-email">Email</Label>
                  <Input
                    id="nok-email"
                    type="email"
                    value={contacts.nextOfKin.email}
                    onChange={(e) => updateContact("nextOfKin", "email", e.target.value)}
                    placeholder="e.g., jane@example.com"
                    maxLength={200}
                    data-testid="input-nok-email"
                  />
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button
                  onClick={() => saveContactsMutation.mutate(contacts)}
                  disabled={saveContactsMutation.isPending || contactsQuery.isLoading || !contactsProfileId}
                  data-testid="button-save-contacts-emergency"
                >
                  <Check className="w-4 h-4 mr-2" />
                  {saveContactsMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Emergency Info & Break-Glass Sharing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Emergency Info &amp; Break-Glass Sharing
              </CardTitle>
              <CardDescription>
                Store the critical details an ER or EMS team needs, then create a
                time-limited, revocable link to share a minimal summary. Every
                access is logged and you can revoke a link anytime.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emg-blood">Blood type</Label>
                  <Input
                    id="emg-blood"
                    value={emergency.bloodType}
                    onChange={(e) => setEmergency((p) => ({ ...p, bloodType: e.target.value }))}
                    placeholder="e.g., O+"
                    maxLength={200}
                    data-testid="input-emergency-blood-type"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="emg-allergies">Allergies (summary)</Label>
                <Textarea
                  id="emg-allergies"
                  value={emergency.allergiesSummary}
                  onChange={(e) => setEmergency((p) => ({ ...p, allergiesSummary: e.target.value }))}
                  placeholder="e.g., Penicillin (anaphylaxis), peanuts"
                  maxLength={5000}
                  data-testid="input-emergency-allergies"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emg-conditions">Critical conditions</Label>
                <Textarea
                  id="emg-conditions"
                  value={emergency.criticalConditions}
                  onChange={(e) => setEmergency((p) => ({ ...p, criticalConditions: e.target.value }))}
                  placeholder="e.g., Type 1 diabetes, on anticoagulants"
                  maxLength={5000}
                  data-testid="input-emergency-conditions"
                />
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emg-pharm-name">Pharmacy name</Label>
                  <Input
                    id="emg-pharm-name"
                    value={emergency.pharmacy.name}
                    onChange={(e) => setEmergency((p) => ({ ...p, pharmacy: { ...p.pharmacy, name: e.target.value } }))}
                    placeholder="e.g., Main Street Pharmacy"
                    maxLength={200}
                    data-testid="input-emergency-pharmacy-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emg-pharm-phone">Pharmacy phone</Label>
                  <Input
                    id="emg-pharm-phone"
                    type="tel"
                    value={emergency.pharmacy.phone}
                    onChange={(e) => setEmergency((p) => ({ ...p, pharmacy: { ...p.pharmacy, phone: e.target.value } }))}
                    placeholder="e.g., (555) 123-4567"
                    maxLength={200}
                    data-testid="input-emergency-pharmacy-phone"
                  />
                </div>
              </div>

              <Separator />

              {/* Advance directive */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Advance directive
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Has directive</span>
                    <Switch
                      checked={emergency.advanceDirective.hasDirective}
                      onCheckedChange={(v) =>
                        setEmergency((p) => ({ ...p, advanceDirective: { ...p.advanceDirective, hasDirective: v } }))
                      }
                      data-testid="switch-emergency-has-directive"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emg-directive-type">Type</Label>
                    <Select
                      value={emergency.advanceDirective.type || undefined}
                      onValueChange={(v) =>
                        setEmergency((p) => ({ ...p, advanceDirective: { ...p.advanceDirective, type: v } }))
                      }
                    >
                      <SelectTrigger id="emg-directive-type" data-testid="select-emergency-directive-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dnr">Do Not Resuscitate (DNR)</SelectItem>
                        <SelectItem value="living_will">Living Will</SelectItem>
                        <SelectItem value="healthcare_proxy">Healthcare Proxy</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Document</Label>
                    <div className="flex items-center gap-2">
                      <ObjectUploader
                        maxNumberOfFiles={1}
                        onGetUploadParameters={advanceDirectiveUpload.onGetUploadParameters}
                        onComplete={advanceDirectiveUpload.onComplete}
                        buttonClassName="w-full"
                      >
                        <Upload className="w-4 h-4 mr-2" /> Upload
                      </ObjectUploader>
                      {emergency.advanceDirective.fileKey && (
                        <Badge variant="secondary" className="text-xs"><Check className="w-3 h-3 mr-1" />Attached</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emg-directive-notes">Notes</Label>
                  <Textarea
                    id="emg-directive-notes"
                    value={emergency.advanceDirective.notes}
                    onChange={(e) =>
                      setEmergency((p) => ({ ...p, advanceDirective: { ...p.advanceDirective, notes: e.target.value } }))
                    }
                    placeholder="Any directive details responders should know"
                    maxLength={5000}
                    data-testid="input-emergency-directive-notes"
                  />
                </div>
              </div>

              <Separator />

              {/* Insurance card */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" /> Insurance card
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emg-ins-payer">Payer</Label>
                    <Input
                      id="emg-ins-payer"
                      value={emergency.insuranceCard.payer}
                      onChange={(e) => setEmergency((p) => ({ ...p, insuranceCard: { ...p.insuranceCard, payer: e.target.value } }))}
                      placeholder="e.g., Blue Cross"
                      maxLength={200}
                      data-testid="input-emergency-insurance-payer"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emg-ins-member">Member ID</Label>
                    <Input
                      id="emg-ins-member"
                      value={emergency.insuranceCard.memberId}
                      onChange={(e) => setEmergency((p) => ({ ...p, insuranceCard: { ...p.insuranceCard, memberId: e.target.value } }))}
                      placeholder="e.g., ABC123456"
                      maxLength={200}
                      data-testid="input-emergency-insurance-member"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <ObjectUploader
                    maxNumberOfFiles={1}
                    onGetUploadParameters={insuranceFrontUpload.onGetUploadParameters}
                    onComplete={insuranceFrontUpload.onComplete}
                  >
                    <Upload className="w-4 h-4 mr-2" /> Front of card
                  </ObjectUploader>
                  {emergency.insuranceCard.frontFileKey && (
                    <Badge variant="secondary" className="text-xs"><Check className="w-3 h-3 mr-1" />Front attached</Badge>
                  )}
                  <ObjectUploader
                    maxNumberOfFiles={1}
                    onGetUploadParameters={insuranceBackUpload.onGetUploadParameters}
                    onComplete={insuranceBackUpload.onComplete}
                  >
                    <Upload className="w-4 h-4 mr-2" /> Back of card
                  </ObjectUploader>
                  {emergency.insuranceCard.backFileKey && (
                    <Badge variant="secondary" className="text-xs"><Check className="w-3 h-3 mr-1" />Back attached</Badge>
                  )}
                </div>
              </div>

              <Separator />

              {/* Consent toggle */}
              <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
                <div className="space-y-1">
                  <Label htmlFor="emg-consent" className="font-medium">
                    Authorize emergency sharing
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    I authorize emergency responders to view this info via a share I create.
                    Required before generating a share link.
                  </p>
                </div>
                <Switch
                  id="emg-consent"
                  checked={emergencyConsent}
                  onCheckedChange={(v) =>
                    setEmergency((p) => ({ ...p, consentEmergencySharingAt: v ? new Date().toISOString() : null }))
                  }
                  data-testid="switch-emergency-consent"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => saveEmergencyMutation.mutate(emergency)}
                  disabled={saveEmergencyMutation.isPending || emergencyQuery.isLoading || !contactsProfileId}
                  data-testid="button-save-emergency-info"
                >
                  <Check className="w-4 h-4 mr-2" />
                  {saveEmergencyMutation.isPending ? "Saving..." : "Save Emergency Info"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Generate emergency share */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-primary" />
                Generate emergency share
              </CardTitle>
              <CardDescription>
                Emergency responders can view a minimal summary. Every access is logged. You can revoke anytime.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!emergencyConsent && (
                <div className="flex items-center gap-2 rounded-md border border-orange-300 bg-orange-50 dark:bg-orange-950/30 p-3 text-sm text-orange-800 dark:text-orange-200">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Enable the consent toggle above and save before creating a share.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emg-token-label">Label (optional)</Label>
                  <Input
                    id="emg-token-label"
                    value={tokenLabel}
                    onChange={(e) => setTokenLabel(e.target.value)}
                    placeholder="e.g., Wallet card"
                    maxLength={200}
                    data-testid="input-emergency-token-label"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emg-token-pin">PIN (optional)</Label>
                  <Input
                    id="emg-token-pin"
                    inputMode="numeric"
                    value={tokenPin}
                    onChange={(e) => setTokenPin(e.target.value)}
                    placeholder="4-8 digits"
                    maxLength={8}
                    data-testid="input-emergency-token-pin"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emg-token-expiry">Expires in</Label>
                  <Select value={tokenExpiry} onValueChange={setTokenExpiry}>
                    <SelectTrigger id="emg-token-expiry" data-testid="select-emergency-token-expiry">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 hour</SelectItem>
                      <SelectItem value="24">24 hours</SelectItem>
                      <SelectItem value="72">72 hours</SelectItem>
                      <SelectItem value="168">7 days</SelectItem>
                      <SelectItem value="720">30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => generateTokenMutation.mutate()}
                  disabled={generateTokenMutation.isPending || !emergencyConsent || !contactsProfileId}
                  data-testid="button-generate-emergency-share"
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  {generateTokenMutation.isPending ? "Creating..." : "Generate share"}
                </Button>
              </div>

              {generatedToken && (
                <div className="rounded-lg border p-4 space-y-3" data-testid="emergency-generated-share">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <QrCode className="w-4 h-4" /> Share created — shown only once
                  </div>
                  {qrDataUrl && (
                    <img
                      src={qrDataUrl}
                      alt="Emergency share QR code"
                      className="w-44 h-44 border rounded bg-white p-2"
                      data-testid="img-emergency-qr"
                    />
                  )}
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={`${window.location.origin}${generatedToken.shareUrl}`}
                      className="font-mono text-xs"
                      data-testid="input-emergency-share-url"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyShareLink(generatedToken)}
                      data-testid="button-copy-emergency-share"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {generatedToken.hasPin ? "PIN protected. " : ""}
                    Expires {new Date(generatedToken.expiresAt).toLocaleString()}.
                  </p>
                </div>
              )}

              {/* Active tokens */}
              <div className="space-y-2">
                <Label className="text-sm">Active shares</Label>
                {activeTokens.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active emergency shares.</p>
                ) : (
                  <div className="space-y-2">
                    {activeTokens.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between border rounded-lg p-3"
                        data-testid={`emergency-token-${t.id}`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {t.label || "Emergency share"}
                            {t.hasPin && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                <KeyRound className="w-3 h-3 mr-1" />PIN
                              </Badge>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Expires {new Date(t.expiresAt).toLocaleString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revokeTokenMutation.mutate(t.id)}
                          disabled={revokeTokenMutation.isPending}
                          data-testid={`button-revoke-emergency-${t.id}`}
                        >
                          <Trash2 className="w-4 h-4 mr-1 text-destructive" /> Revoke
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insurance" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Insurance Information
                </CardTitle>
                <CardDescription>Your health insurance coverage</CardDescription>
              </div>
              <Button size="sm" onClick={() => { setEditingInsurance(null); setShowInsuranceDialog(true); }} data-testid="button-add-insurance">
                <Plus className="w-4 h-4 mr-2" /> Add Insurance
              </Button>
            </CardHeader>
            <CardContent>
              {profile.insuranceInfo.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No insurance on file</p>
                  <p className="text-sm">Add your insurance information for billing</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {profile.insuranceInfo.map(ins => (
                    <div key={ins.id} className="p-4 border rounded-lg hover-elevate">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Building className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{ins.insurerName}</p>
                              <Badge variant={ins.coverageStatus === 'active' ? 'default' : 'secondary'} className="text-xs capitalize">{ins.type}</Badge>
                              <Badge variant={ins.coverageStatus === 'active' ? 'outline' : 'destructive'} className="text-xs capitalize">{ins.coverageStatus}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{ins.planName}</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                              <div><span className="text-muted-foreground">Member ID:</span> <span className="font-mono">{ins.memberId}</span></div>
                              {ins.groupNumber && <div><span className="text-muted-foreground">Group:</span> <span className="font-mono">{ins.groupNumber}</span></div>}
                              <div><span className="text-muted-foreground">Effective:</span> {formatDate(ins.effectiveDate)}</div>
                              {ins.copay && <div><span className="text-muted-foreground">Copay:</span> ${ins.copay}</div>}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => { setEditingInsurance(ins); setShowInsuranceDialog(true); }} data-testid={`button-edit-insurance-${ins.id}`}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteInsuranceMutation.mutate(ins.id)} data-testid={`button-delete-insurance-${ins.id}`}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medical" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Stethoscope className="w-4 h-4 text-primary" />
                  Active Conditions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {profile.medicalHistory.conditions.filter(c => c.status === 'active').map(cond => (
                      <div key={cond.id} className="flex items-center justify-between p-2 rounded border">
                        <span className="font-medium">{cond.name}</span>
                        {cond.severity && <Badge variant={cond.severity === 'severe' ? 'destructive' : cond.severity === 'moderate' ? 'default' : 'secondary'} className="text-xs capitalize">{cond.severity}</Badge>}
                      </div>
                    ))}
                    {profile.medicalHistory.conditions.filter(c => c.status === 'active').length === 0 && <p className="text-muted-foreground text-sm">No active conditions</p>}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Pill className="w-4 h-4 text-primary" />
                  Current Medications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {profile.medicalHistory.medications.filter(m => m.status === 'active').map(med => (
                      <div key={med.id} className="p-2 rounded border">
                        <p className="font-medium">{med.name}</p>
                        <p className="text-sm text-muted-foreground">{med.dosage} - {med.frequency}</p>
                      </div>
                    ))}
                    {profile.medicalHistory.medications.filter(m => m.status === 'active').length === 0 && <p className="text-muted-foreground text-sm">No active medications</p>}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Allergies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {profile.medicalHistory.allergies.map(allergy => (
                      <div key={allergy.id} className="flex items-center justify-between p-2 rounded border border-destructive/30 bg-destructive/5">
                        <div>
                          <p className="font-medium">{allergy.substance}</p>
                          <p className="text-sm text-muted-foreground">{allergy.reaction}</p>
                        </div>
                        <Badge variant={allergy.severity === 'severe' ? 'destructive' : 'secondary'} className="text-xs capitalize">{allergy.severity}</Badge>
                      </div>
                    ))}
                    {profile.medicalHistory.allergies.length === 0 && <p className="text-muted-foreground text-sm">No known allergies</p>}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="w-4 h-4 text-primary" />
                  Recent Vitals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {profile.medicalHistory.recentVitals.bloodPressure && (
                    <div className="p-3 rounded border text-center">
                      <p className="text-2xl font-bold">{profile.medicalHistory.recentVitals.bloodPressure.systolic}/{profile.medicalHistory.recentVitals.bloodPressure.diastolic}</p>
                      <p className="text-xs text-muted-foreground">Blood Pressure</p>
                    </div>
                  )}
                  {profile.medicalHistory.recentVitals.heartRate && (
                    <div className="p-3 rounded border text-center">
                      <p className="text-2xl font-bold">{profile.medicalHistory.recentVitals.heartRate.value}</p>
                      <p className="text-xs text-muted-foreground">Heart Rate (bpm)</p>
                    </div>
                  )}
                  {profile.medicalHistory.recentVitals.weight && (
                    <div className="p-3 rounded border text-center">
                      <p className="text-2xl font-bold">{profile.medicalHistory.recentVitals.weight.value}</p>
                      <p className="text-xs text-muted-foreground">Weight ({profile.medicalHistory.recentVitals.weight.unit})</p>
                    </div>
                  )}
                  {profile.medicalHistory.recentVitals.bmi && (
                    <div className="p-3 rounded border text-center">
                      <p className="text-2xl font-bold">{profile.medicalHistory.recentVitals.bmi.value.toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">BMI</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Syringe className="w-4 h-4 text-primary" />
                  Recent Immunizations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-32">
                  <div className="space-y-2">
                    {profile.medicalHistory.immunizations.slice(0, 5).map(imm => (
                      <div key={imm.id} className="flex items-center justify-between p-2 rounded border">
                        <span>{imm.vaccine}</span>
                        <span className="text-sm text-muted-foreground">{formatDate(imm.date)}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="w-4 h-4 text-primary" />
                  Past Procedures
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-32">
                  <div className="space-y-2">
                    {profile.medicalHistory.procedures.map(proc => (
                      <div key={proc.id} className="flex items-center justify-between p-2 rounded border">
                        <div>
                          <p className="font-medium">{proc.name}</p>
                          {proc.performer && <p className="text-sm text-muted-foreground">{proc.performer}</p>}
                        </div>
                        <span className="text-sm text-muted-foreground">{formatDate(proc.date)}</span>
                      </div>
                    ))}
                    {profile.medicalHistory.procedures.length === 0 && <p className="text-muted-foreground text-sm">No procedures on record</p>}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showEmergencyContactDialog} onOpenChange={setShowEmergencyContactDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEmergencyContact ? 'Edit Emergency Contact' : 'Add Emergency Contact'}</DialogTitle>
            <DialogDescription>Enter the contact details below</DialogDescription>
          </DialogHeader>
          <EmergencyContactForm
            initialData={editingEmergencyContact}
            onSave={(data) => {
              if (editingEmergencyContact) {
                updateEmergencyContactMutation.mutate({ contactId: editingEmergencyContact.id, data });
              } else {
                addEmergencyContactMutation.mutate(data as Omit<EmergencyContact, 'id'>);
              }
            }}
            onCancel={() => setShowEmergencyContactDialog(false)}
            isPending={addEmergencyContactMutation.isPending || updateEmergencyContactMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showInsuranceDialog} onOpenChange={setShowInsuranceDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingInsurance ? 'Edit Insurance' : 'Add Insurance'}</DialogTitle>
            <DialogDescription>Enter the insurance details below</DialogDescription>
          </DialogHeader>
          <InsuranceForm
            initialData={editingInsurance}
            onSave={(data) => {
              if (editingInsurance) {
                updateInsuranceMutation.mutate({ insuranceId: editingInsurance.id, data });
              } else {
                addInsuranceMutation.mutate(data as Omit<InsuranceInfo, 'id'>);
              }
            }}
            onCancel={() => setShowInsuranceDialog(false)}
            isPending={addInsuranceMutation.isPending || updateInsuranceMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmergencyContactForm({ initialData, onSave, onCancel, isPending }: { initialData: EmergencyContact | null; onSave: (data: Partial<EmergencyContact>) => void; onCancel: () => void; isPending: boolean }) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    relationship: initialData?.relationship || '',
    phone: initialData?.phone || '',
    alternatePhone: initialData?.alternatePhone || '',
    email: initialData?.email || '',
    isPrimary: initialData?.isPrimary || false,
    canMakeDecisions: initialData?.canMakeDecisions || false,
    notes: initialData?.notes || ''
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ec-name">Name</Label>
          <Input id="ec-name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} data-testid="input-ec-name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ec-relationship">Relationship</Label>
          <Input id="ec-relationship" value={formData.relationship} onChange={(e) => setFormData({ ...formData, relationship: e.target.value })} placeholder="e.g., Spouse, Parent" data-testid="input-ec-relationship" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ec-phone">Phone</Label>
          <Input id="ec-phone" type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} data-testid="input-ec-phone" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ec-email">Email</Label>
          <Input id="ec-email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} data-testid="input-ec-email" />
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch checked={formData.isPrimary} onCheckedChange={(checked) => setFormData({ ...formData, isPrimary: checked })} data-testid="switch-ec-primary" />
          <Label>Primary Contact</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={formData.canMakeDecisions} onCheckedChange={(checked) => setFormData({ ...formData, canMakeDecisions: checked })} data-testid="switch-ec-decisions" />
          <Label>Can Make Medical Decisions</Label>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(formData)} disabled={isPending || !formData.name || !formData.phone} data-testid="button-save-emergency-contact">
          {isPending ? 'Saving...' : 'Save'}
        </Button>
      </DialogFooter>
    </div>
  );
}

function InsuranceForm({ initialData, onSave, onCancel, isPending }: { initialData: InsuranceInfo | null; onSave: (data: Partial<InsuranceInfo>) => void; onCancel: () => void; isPending: boolean }) {
  const [formData, setFormData] = useState({
    type: initialData?.type || 'primary' as 'primary' | 'secondary' | 'tertiary',
    insurerName: initialData?.insurerName || '',
    planName: initialData?.planName || '',
    memberId: initialData?.memberId || '',
    groupNumber: initialData?.groupNumber || '',
    subscriberName: initialData?.subscriberName || '',
    subscriberDob: initialData?.subscriberDob || '',
    relationshipToSubscriber: initialData?.relationshipToSubscriber || 'Self',
    effectiveDate: initialData?.effectiveDate || '',
    coverageStatus: initialData?.coverageStatus || 'active' as 'active' | 'pending' | 'terminated',
    copay: initialData?.copay || 0,
    deductible: initialData?.deductible || 0
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ins-type">Type</Label>
          <Select value={formData.type} onValueChange={(value: 'primary' | 'secondary' | 'tertiary') => setFormData({ ...formData, type: value })}>
            <SelectTrigger id="ins-type" data-testid="select-ins-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="primary">Primary</SelectItem>
              <SelectItem value="secondary">Secondary</SelectItem>
              <SelectItem value="tertiary">Tertiary</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ins-status">Status</Label>
          <Select value={formData.coverageStatus} onValueChange={(value: 'active' | 'pending' | 'terminated') => setFormData({ ...formData, coverageStatus: value })}>
            <SelectTrigger id="ins-status" data-testid="select-ins-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="terminated">Terminated</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 col-span-2">
          <Label htmlFor="ins-name">Insurance Company</Label>
          <Input id="ins-name" value={formData.insurerName} onChange={(e) => setFormData({ ...formData, insurerName: e.target.value })} data-testid="input-ins-name" />
        </div>
        <div className="space-y-2 col-span-2">
          <Label htmlFor="ins-plan">Plan Name</Label>
          <Input id="ins-plan" value={formData.planName} onChange={(e) => setFormData({ ...formData, planName: e.target.value })} data-testid="input-ins-plan" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ins-member">Member ID</Label>
          <Input id="ins-member" value={formData.memberId} onChange={(e) => setFormData({ ...formData, memberId: e.target.value })} data-testid="input-ins-member" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ins-group">Group Number</Label>
          <Input id="ins-group" value={formData.groupNumber} onChange={(e) => setFormData({ ...formData, groupNumber: e.target.value })} data-testid="input-ins-group" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ins-effective">Effective Date</Label>
          <Input id="ins-effective" type="date" value={formData.effectiveDate} onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })} data-testid="input-ins-effective" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ins-copay">Copay ($)</Label>
          <Input id="ins-copay" type="number" value={formData.copay} onChange={(e) => setFormData({ ...formData, copay: parseInt(e.target.value) || 0 })} data-testid="input-ins-copay" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(formData)} disabled={isPending || !formData.insurerName || !formData.memberId} data-testid="button-save-insurance">
          {isPending ? 'Saving...' : 'Save'}
        </Button>
      </DialogFooter>
    </div>
  );
}
