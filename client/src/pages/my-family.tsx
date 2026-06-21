import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import {
  Users,
  Plus,
  ChevronRight,
  ChevronLeft,
  Shield,
  Check,
  Baby,
  Heart,
  User,
  Lock,
  FileText,
  Upload,
  Eye,
  EyeOff,
  Info,
  CheckCircle,
  Settings,
  PawPrint,
  Pill,
  Activity,
  Stethoscope,
  Calendar,
  ExternalLink,
  X,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

type ProfileType = "child" | "dependent_adult" | "elder";
type RelationshipType = "child" | "spouse" | "parent" | "sibling" | "grandparent" | "guardian" | "other";
type VerificationDocType = "birth_certificate" | "guardianship_order" | "power_of_attorney" | "marriage_certificate" | "adoption_decree" | "court_order" | "other";
type WizardStep = "relationship" | "identity" | "verification" | "health" | "confirmation";

interface FamilyProfile {
  id: string;
  profileId: string;
  userId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  profileType: string;
  relationship: string;
  profileImageUrl: string | null;
  status: string;
  isDefault: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FamilyHealthData {
  conditions: string[];
  medications: string[];
  allergies: string[];
  appointments: string[];
}

interface FamilyVerification {
  id: string;
  status: string;
  profileId: string;
}

interface PetRecord {
  id: string;
  name: string;
  species: string;
  breed?: string;
  dateOfBirth?: string | null;
  ageYears?: number;
}

type HealthEntryType = "conditions" | "medications" | "allergies" | "appointments";

const WIZARD_STEPS: { key: WizardStep; label: string; icon: typeof User }[] = [
  { key: "relationship", label: "Relationship", icon: Users },
  { key: "identity", label: "Identity", icon: User },
  { key: "verification", label: "Verification", icon: Shield },
  { key: "health", label: "Health Profile", icon: Activity },
  { key: "confirmation", label: "Confirm", icon: Check },
];

interface MemberDraft {
  profileType: ProfileType;
  relationship: RelationshipType;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  medicalRecordNumber: string;
  insuranceId: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  notes: string;
  verificationDocType: VerificationDocType;
  verificationDocFile: File | null;
  verificationDocName: string;
  attestation: boolean;
  conditions: string[];
  medications: string[];
  allergies: string[];
}

const profileTypeConfig: Record<string, { label: string; icon: typeof User; description: string }> = {
  self: { label: "Self", icon: User, description: "Your own health profile" },
  child: { label: "Child (Under 18)", icon: Baby, description: "Minor child requiring parental/guardian consent" },
  dependent_adult: { label: "Dependent Adult", icon: Users, description: "Adult dependent requiring caregiver support" },
  elder: { label: "Elder / Senior", icon: Heart, description: "Senior family member under your care" },
};

const relationshipOptions: Record<RelationshipType, string> = {
  child: "Child",
  spouse: "Spouse",
  parent: "Parent",
  sibling: "Sibling",
  grandparent: "Grandparent",
  guardian: "Guardian",
  other: "Other",
};

const verificationDocOptions: Record<VerificationDocType, string> = {
  birth_certificate: "Birth Certificate",
  guardianship_order: "Guardianship Order",
  power_of_attorney: "Power of Attorney (HPOA)",
  marriage_certificate: "Marriage Certificate",
  adoption_decree: "Adoption Decree",
  court_order: "Court Order",
  other: "Other Legal Document",
};

const genderOptions = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const commonConditions = [
  "Type 2 Diabetes", "Hypertension", "Asthma", "COPD", "Heart Disease",
  "Arthritis", "Epilepsy", "Depression", "Anxiety", "ADHD",
  "Autism Spectrum", "Celiac Disease", "Eczema", "Food Allergies",
];

const commonMedications = [
  "Metformin", "Lisinopril", "Amlodipine", "Atorvastatin", "Levothyroxine",
  "Metoprolol", "Omeprazole", "Albuterol", "Fluticasone", "Sertraline",
  "Escitalopram", "Methylphenidate", "Insulin", "Gabapentin",
];

const commonAllergens = [
  "Penicillin", "Sulfa drugs", "NSAIDs", "Aspirin", "Latex",
  "Peanuts", "Tree nuts", "Shellfish", "Eggs", "Dairy",
  "Soy", "Wheat/Gluten", "Bee stings", "Pollen",
];

function getInitials(first: string, last: string): string {
  return ((first?.[0] || "") + (last?.[0] || "")).toUpperCase() || "?";
}

function getAge(dob: string): number {
  if (!dob) return 0;
  const birth = new Date(dob + "T00:00:00");
  return Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

function createEmptyDraft(): MemberDraft {
  return {
    profileType: "child",
    relationship: "child",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    medicalRecordNumber: "",
    insuranceId: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelationship: "",
    notes: "",
    verificationDocType: "birth_certificate",
    verificationDocFile: null,
    verificationDocName: "",
    attestation: false,
    conditions: [],
    medications: [],
    allergies: [],
  };
}

interface QuickAddBadgesProps {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (item: string) => void;
  customPlaceholder: string;
  testIdPrefix: string;
}

function QuickAddBadges({ label, options, selected, onToggle, customPlaceholder, testIdPrefix }: QuickAddBadgesProps) {
  const [customValue, setCustomValue] = useState("");

  const addCustom = () => {
    const v = customValue.trim();
    if (v && !selected.includes(v)) {
      onToggle(v);
      setCustomValue("");
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors min-h-[32px] ${
              selected.includes(opt)
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
            }`}
            data-testid={`${testIdPrefix}-${opt.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {opt}
            {selected.includes(opt) && <Check className="h-3 w-3 inline ml-1" aria-hidden="true" />}
          </button>
        ))}
      </div>
      {selected.filter(s => !options.includes(s)).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.filter(s => !options.includes(s)).map(s => (
            <Badge key={s} variant="secondary" className="gap-1">
              {s}
              <button type="button" onClick={() => onToggle(s)} className="ml-0.5" aria-label={`Remove ${s}`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={customValue}
          onChange={e => setCustomValue(e.target.value)}
          placeholder={customPlaceholder}
          className="text-sm"
          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCustom())}
          data-testid={`${testIdPrefix}-custom-input`}
        />
        <Button type="button" variant="outline" size="sm" onClick={addCustom} disabled={!customValue.trim()} data-testid={`${testIdPrefix}-add-custom`}>
          Add
        </Button>
      </div>
    </div>
  );
}

export default function MyFamily() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("members");
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>("relationship");
  const [draft, setDraft] = useState<MemberDraft>(createEmptyDraft());
  const [reAuthOpen, setReAuthOpen] = useState(false);
  const [reAuthPassword, setReAuthPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdProfile, setCreatedProfile] = useState<FamilyProfile | null>(null);
  const [familyDataMember, setFamilyDataMember] = useState<string>("all");
  const [healthEntryMember, setHealthEntryMember] = useState<string | null>(null);
  const [healthEntryType, setHealthEntryType] = useState<HealthEntryType>("conditions");
  const [healthEntryDialogOpen, setHealthEntryDialogOpen] = useState(false);
  const [healthEntryItems, setHealthEntryItems] = useState<string[]>([]);
  const [reAuthIntent, setReAuthIntent] = useState<"wizard" | "health-entry">("wizard");
  const [pendingHealthEntry, setPendingHealthEntry] = useState<{ profileId: string; type: HealthEntryType } | null>(null);
  const [reAuthMode, setReAuthMode] = useState<"password" | "sso">("password");

  const { data: membersResponse, isLoading: profilesLoading } = useQuery<{ members: FamilyProfile[] }>({
    queryKey: ["/api/family-hub/members"],
  });
  const profiles: FamilyProfile[] = membersResponse?.members || [];

  const { data: verificationsData } = useQuery<{ verifications: FamilyVerification[] }>({
    queryKey: ["/api/family-verification"],
  });

  const { data: petData } = useQuery<{ pets: PetRecord[] }>({
    queryKey: ["/api/pet-health/pets"],
  });

  const verifications: FamilyVerification[] = verificationsData?.verifications || [];
  const pets: PetRecord[] = petData?.pets || [];

  const selfProfile = profiles.find((p: FamilyProfile) => p.profileType === "self");
  const familyProfiles = profiles.filter((p: FamilyProfile) => p.profileType !== "self");

  const selectedHealthProfiles = familyDataMember === "all"
    ? profiles
    : profiles.filter((p: FamilyProfile) => p.id === familyDataMember);

  const memberHealthQueries = selectedHealthProfiles.map((p: FamilyProfile) => ({
    profileId: p.id,
    name: `${p.firstName} ${p.lastName}`,
  }));

  const { data: healthDataMap } = useQuery({
    queryKey: ["/api/family-hub/members-health", familyDataMember],
    queryFn: async () => {
      const results: Record<string, FamilyHealthData> = {};
      for (const m of memberHealthQueries) {
        try {
          const res = await fetch(`/api/family-hub/member/${m.profileId}/health`);
          if (res.ok) {
            results[m.profileId] = await res.json();
          }
        } catch {
          results[m.profileId] = { conditions: [], medications: [], allergies: [], appointments: [] };
        }
      }
      return results;
    },
    enabled: (activeTab === "data" || activeTab === "members") && memberHealthQueries.length > 0,
  });

  const reAuthMutation = useMutation({
    mutationFn: async (credentials: { password?: string; ssoReauth?: boolean }) => {
      const res = await apiRequest("POST", "/api/family-hub/reauth", credentials);
      const data = await res.json();
      if (data.requiresSsoReauth) {
        throw new Error("REQUIRES_SSO_REAUTH");
      }
      if (data.requiresFreshLogin) {
        throw new Error("REQUIRES_FRESH_LOGIN");
      }
      return data;
    },
    onSuccess: (data) => {
      setSessionToken(data.sessionToken);
      setReAuthOpen(false);
      setReAuthPassword("");
      setReAuthMode("password");

      if (reAuthIntent === "health-entry" && pendingHealthEntry) {
        setHealthEntryMember(pendingHealthEntry.profileId);
        setHealthEntryType(pendingHealthEntry.type);
        setHealthEntryItems([]);
        setHealthEntryDialogOpen(true);
        setPendingHealthEntry(null);
        toast({ title: "Verified", description: "Identity confirmed. You can now add health data." });
      } else {
        setShowWizard(true);
        setWizardStep("relationship");
        setDraft(createEmptyDraft());
        toast({ title: "Verified", description: "Identity confirmed. You can now add a family member." });
      }
    },
    onError: (err: Error) => {
      if (err.message === "REQUIRES_SSO_REAUTH") {
        setReAuthMode("sso");
        toast({ title: "Password not available", description: "SSO accounts must re-login to verify identity.", variant: "default" });
      } else if (err.message === "REQUIRES_FRESH_LOGIN") {
        toast({ title: "Session too old", description: "Please log out and log back in, then try again.", variant: "destructive" });
      } else {
        toast({ title: "Verification failed", description: "Please try again.", variant: "destructive" });
      }
    },
  });

  const healthEntryMutation = useMutation({
    mutationFn: async ({ profileId, entryType, entries }: { profileId: string; entryType: string; entries: string[] }) => {
      const res = await apiRequest("POST", `/api/family-hub/member/${profileId}/health-entry`, {
        sessionToken,
        entryType,
        entries,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-hub/members-health"] });
      setHealthEntryDialogOpen(false);
      setHealthEntryItems([]);
      toast({ title: "Health data saved", description: "Entries have been recorded." });
    },
    onError: (err: Error) => {
      if (err?.message?.includes("401") || err?.message?.includes("Re-auth")) {
        setSessionToken(null);
        toast({ title: "Session expired", description: "Please re-verify your identity to add health data.", variant: "destructive" });
      } else {
        toast({ title: "Failed to save", description: "Please try again.", variant: "destructive" });
      }
    },
  });

  const handleStartWizard = () => {
    if (sessionToken) {
      setShowWizard(true);
      setWizardStep("relationship");
      setDraft(createEmptyDraft());
    } else {
      setReAuthIntent("wizard");
      setPendingHealthEntry(null);
      setReAuthOpen(true);
    }
  };

  const handleReAuth = () => {
    if (reAuthMode === "sso") {
      reAuthMutation.mutate({ ssoReauth: true });
    } else {
      if (!reAuthPassword.trim()) {
        toast({ title: "Password required", description: "Enter your password to continue.", variant: "destructive" });
        return;
      }
      reAuthMutation.mutate({ password: reAuthPassword });
    }
  };

  const updateDraft = (updates: Partial<MemberDraft>) => {
    setDraft(prev => ({ ...prev, ...updates }));
  };

  const toggleArrayItem = (field: "conditions" | "medications" | "allergies", item: string) => {
    setDraft(prev => ({
      ...prev,
      [field]: prev[field].includes(item) ? prev[field].filter(i => i !== item) : [...prev[field], item],
    }));
  };

  const toggleHealthEntryItem = (item: string) => {
    setHealthEntryItems(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  };

  const canProceed = (): boolean => {
    switch (wizardStep) {
      case "relationship":
        return !!draft.profileType && !!draft.relationship;
      case "identity":
        return !!draft.firstName.trim() && !!draft.lastName.trim() && !!draft.dateOfBirth && !!draft.gender;
      case "verification":
        return draft.attestation && !!draft.verificationDocFile && !!draft.verificationDocName;
      case "health":
        return true;
      default:
        return true;
    }
  };

  const nextStep = async () => {
    const idx = WIZARD_STEPS.findIndex(s => s.key === wizardStep);
    if (idx < WIZARD_STEPS.length - 1) {
      try {
        const res = await apiRequest("POST", "/api/family-hub/validate-session", { sessionToken });
        const data = await res.json();
        if (!data.valid) throw new Error("invalid");

        await apiRequest("POST", "/api/family-hub/audit", {
          action: "write",
          resourceType: "FamilyOnboarding",
          details: `Completed wizard step: ${WIZARD_STEPS[idx].label}`,
        });

        setWizardStep(WIZARD_STEPS[idx + 1].key);
      } catch {
        setSessionToken(null);
        setShowWizard(false);
        toast({ title: "Session expired", description: "Please re-verify your identity.", variant: "destructive" });
      }
    }
  };

  const prevStep = () => {
    const idx = WIZARD_STEPS.findIndex(s => s.key === wizardStep);
    if (idx > 0) setWizardStep(WIZARD_STEPS[idx - 1].key);
  };

  const handleSubmitWizard = async () => {
    setSubmitting(true);
    try {
      let verificationDocData: { type: string; name: string; objectPath: string } | null = null;
      const requiresDoc = draft.relationship !== "self";

      if (requiresDoc && draft.verificationDocFile && draft.verificationDocName) {
        const uploadMetaRes = await apiRequest("POST", "/api/family-hub/upload-verification-doc", {
          sessionToken,
          fileName: draft.verificationDocFile.name,
          fileSize: draft.verificationDocFile.size,
          contentType: draft.verificationDocFile.type,
        });
        const uploadMeta = await uploadMetaRes.json();

        if (!uploadMeta.uploadURL || !uploadMeta.objectPath) {
          toast({ title: "Upload failed", description: "Could not get upload URL for verification document. Please try again.", variant: "destructive" });
          setSubmitting(false);
          return;
        }

        const uploadRes = await fetch(uploadMeta.uploadURL, {
          method: "PUT",
          body: draft.verificationDocFile,
          headers: { "Content-Type": draft.verificationDocFile.type },
        });

        if (!uploadRes.ok) {
          toast({ title: "Upload failed", description: "Failed to upload verification document. Please try again.", variant: "destructive" });
          setSubmitting(false);
          return;
        }

        verificationDocData = {
          type: draft.verificationDocType,
          name: draft.verificationDocName,
          objectPath: uploadMeta.objectPath,
        };
      } else if (requiresDoc) {
        toast({ title: "Document required", description: "Please upload a verification document before submitting.", variant: "destructive" });
        setSubmitting(false);
        return;
      }

      const res = await apiRequest("POST", "/api/family-hub/add-member", {
        sessionToken,
        member: {
          firstName: draft.firstName.trim(),
          lastName: draft.lastName.trim(),
          dateOfBirth: draft.dateOfBirth,
          gender: draft.gender,
          profileType: draft.profileType,
          relationship: draft.relationship,
          medicalRecordNumber: draft.medicalRecordNumber || null,
          insuranceId: draft.insuranceId || null,
          emergencyContact: draft.emergencyContactName
            ? JSON.stringify({
                name: draft.emergencyContactName,
                phone: draft.emergencyContactPhone,
                relationship: draft.emergencyContactRelationship,
              })
            : null,
          notes: draft.notes || null,
          verificationDoc: verificationDocData,
          attestation: draft.attestation || undefined,
          healthData: {
            conditions: draft.conditions,
            medications: draft.medications,
            allergies: draft.allergies,
          },
        },
      });

      const data = await res.json();
      setCreatedProfile(data.profile);
      setWizardStep("confirmation");
      await queryClient.invalidateQueries({ queryKey: ["/api/family-hub/members"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/family-hub/members-health"] });
      toast({ title: "Family member added", description: `${draft.firstName} ${draft.lastName} has been added to your family.` });
    } catch {
      toast({ title: "Failed to add member", description: "Please try again.", variant: "destructive" });
    }
    setSubmitting(false);
  };

  const closeWizard = () => {
    setShowWizard(false);
    setDraft(createEmptyDraft());
    setCreatedProfile(null);
    setWizardStep("relationship");
  };

  const openHealthEntry = (profileId: string, type: HealthEntryType) => {
    if (!sessionToken) {
      setReAuthIntent("health-entry");
      setPendingHealthEntry({ profileId, type });
      setReAuthOpen(true);
      return;
    }
    setHealthEntryMember(profileId);
    setHealthEntryType(type);
    setHealthEntryItems([]);
    setHealthEntryDialogOpen(true);
  };

  const submitHealthEntry = () => {
    if (!healthEntryMember || healthEntryItems.length === 0) return;
    healthEntryMutation.mutate({
      profileId: healthEntryMember,
      entryType: healthEntryType,
      entries: healthEntryItems,
    });
  };

  const currentStepIndex = WIZARD_STEPS.findIndex(s => s.key === wizardStep);

  const getHealthSummary = (profileId: string) => {
    const data = healthDataMap?.[profileId];
    if (!data) return undefined;
    return {
      conditions: data.conditions?.length || 0,
      medications: data.medications?.length || 0,
      allergies: data.allergies?.length || 0,
      appointments: data.appointments?.length || 0,
    };
  };

  const commonAppointments = [
    "Annual Physical", "Dental Checkup", "Eye Exam", "Dermatology Visit",
    "Cardiology Follow-up", "Pediatric Well-Child", "Vaccination Appointment",
    "Lab Work / Blood Draw", "Specialist Referral", "Physical Therapy",
  ];

  const healthEntryOptions = healthEntryType === "conditions" ? commonConditions
    : healthEntryType === "medications" ? commonMedications
    : healthEntryType === "appointments" ? commonAppointments
    : commonAllergens;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4" role="main" aria-label="My Family hub">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Users className="h-6 w-6 text-primary" aria-hidden="true" />
            My Family
          </h1>
          <p className="text-muted-foreground mt-1">Manage family member profiles, pets, caregivers, and health data in one place.</p>
        </div>
        <Button onClick={handleStartWizard} className="min-h-[44px] gap-2" data-testid="button-add-family-member">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Family Member
        </Button>
      </div>

      <div className="bg-muted/50 rounded-lg p-3 mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Educational only. NOT medical advice. Consult your healthcare provider.</span>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="members" data-testid="tab-members">
            <Users className="h-4 w-4 mr-1.5" aria-hidden="true" />
            Members
          </TabsTrigger>
          <TabsTrigger value="pets" data-testid="tab-pets">
            <PawPrint className="h-4 w-4 mr-1.5" aria-hidden="true" />
            Pets
          </TabsTrigger>
          <TabsTrigger value="data" data-testid="tab-data">
            <Activity className="h-4 w-4 mr-1.5" aria-hidden="true" />
            Health Data
          </TabsTrigger>
          <TabsTrigger value="manage" data-testid="tab-manage">
            <Settings className="h-4 w-4 mr-1.5" aria-hidden="true" />
            Manage
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          {profilesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6 h-40" />
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {selfProfile && (
                <MemberCard
                  key={selfProfile.id}
                  profile={selfProfile}
                  isSelf
                  onViewData={() => { setFamilyDataMember(selfProfile.id); setActiveTab("data"); }}
                  onManageAccess={() => setActiveTab("manage")}
                  healthSummary={getHealthSummary(selfProfile.id)}
                />
              )}
              {familyProfiles.map((p: FamilyProfile) => (
                <MemberCard
                  key={p.id}
                  profile={p}
                  onViewData={() => { setFamilyDataMember(p.id); setActiveTab("data"); }}
                  onManageAccess={() => setActiveTab("manage")}
                  healthSummary={getHealthSummary(p.id)}
                />
              ))}
              <button
                onClick={handleStartWizard}
                className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors min-h-[180px]"
                data-testid="button-add-member-card"
              >
                <Plus className="h-8 w-8" aria-hidden="true" />
                <span className="font-medium">Add Family Member</span>
              </button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="pets" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <PawPrint className="h-5 w-5 text-primary" aria-hidden="true" />
              Pet Health Records
            </h2>
            <Button variant="outline" size="sm" asChild data-testid="button-manage-pets">
              <Link href="/pet-health-records">
                Manage Pets
                <ExternalLink className="h-3.5 w-3.5 ml-1.5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
          {Array.isArray(pets) && pets.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pets.map((pet: PetRecord) => (
                <Card key={pet.id} data-testid={`pet-card-${pet.id}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                        <PawPrint className="h-6 w-6 text-amber-600" aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{pet.name}</h3>
                        <p className="text-sm text-muted-foreground">{pet.species} {pet.breed ? `· ${pet.breed}` : ""}</p>
                        {pet.dateOfBirth && (
                          <p className="text-xs text-muted-foreground mt-1">{getAge(pet.dateOfBirth)} years old</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <PawPrint className="h-12 w-12 mx-auto text-muted-foreground mb-3" aria-hidden="true" />
                <p className="text-muted-foreground mb-3">No pets registered yet.</p>
                <Button variant="outline" asChild data-testid="button-add-pet">
                  <Link href="/pet-health-records">
                    <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                    Add a Pet
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
              Family Health Data
            </h2>
            <Select value={familyDataMember} onValueChange={setFamilyDataMember}>
              <SelectTrigger className="w-full sm:w-64" data-testid="select-member-filter">
                <SelectValue placeholder="All members" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                {profiles.map((p: FamilyProfile) => (
                  <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <HealthDataColumn
              title="Conditions"
              icon={Stethoscope}
              entryType="conditions"
              members={selectedHealthProfiles}
              healthDataMap={healthDataMap || {}}
              onAddEntry={openHealthEntry}
            />
            <HealthDataColumn
              title="Medications"
              icon={Pill}
              entryType="medications"
              members={selectedHealthProfiles}
              healthDataMap={healthDataMap || {}}
              onAddEntry={openHealthEntry}
            />
            <HealthDataColumn
              title="Allergies"
              icon={Activity}
              entryType="allergies"
              members={selectedHealthProfiles}
              healthDataMap={healthDataMap || {}}
              onAddEntry={openHealthEntry}
            />
            <HealthDataColumn
              title="Appointments"
              icon={Calendar}
              entryType="appointments"
              members={selectedHealthProfiles}
              healthDataMap={healthDataMap || {}}
              onAddEntry={openHealthEntry}
            />
          </div>
        </TabsContent>

        <TabsContent value="manage" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card data-testid="card-family-verification">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <Shield className="h-5 w-5 text-blue-600" aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Family Verification</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {verifications.length > 0
                        ? `${verifications.filter((v: FamilyVerification) => v.status === "pending").length} pending, ${verifications.filter((v: FamilyVerification) => v.status === "verified").length} verified`
                        : "Upload legal documents to verify family relationships"}
                    </p>
                    <Button variant="outline" size="sm" className="mt-3 min-h-[36px]" asChild data-testid="button-go-verification">
                      <Link href="/family-verification">
                        Manage Verifications
                        <ChevronRight className="h-3.5 w-3.5 ml-1" aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-caregiver-portal">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                    <Heart className="h-5 w-5 text-purple-600" aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Caregiver Access</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Invite caregivers, manage permissions, and control who can access family health records.
                    </p>
                    <Button variant="outline" size="sm" className="mt-3 min-h-[36px]" asChild data-testid="button-go-caregivers">
                      <Link href="/caregiver-portal">
                        Manage Caregivers
                        <ChevronRight className="h-3.5 w-3.5 ml-1" aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-pet-health">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                    <PawPrint className="h-5 w-5 text-amber-600" aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Pet Health Records</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Manage vaccinations, medications, vet visits, and health records for your pets.
                    </p>
                    <Button variant="outline" size="sm" className="mt-3 min-h-[36px]" asChild data-testid="button-go-pets">
                      <Link href="/pet-health-records">
                        Manage Pets
                        <ChevronRight className="h-3.5 w-3.5 ml-1" aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-profile-settings">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-900/30 flex items-center justify-center shrink-0">
                    <Settings className="h-5 w-5 text-gray-600" aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Profile Settings</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Edit profile details, manage emergency contacts, and update insurance information.
                    </p>
                    <Button variant="outline" size="sm" className="mt-3 min-h-[36px]" asChild data-testid="button-go-profiles">
                      <Link href="/my-family">
                        Manage Profiles
                        <ChevronRight className="h-3.5 w-3.5 ml-1" aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Re-Auth Dialog */}
      <Dialog open={reAuthOpen} onOpenChange={(open) => {
        setReAuthOpen(open);
        if (!open) { setReAuthMode("password"); }
      }}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-reauth">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" aria-hidden="true" />
              Verify Your Identity
            </DialogTitle>
            <DialogDescription>
              {reAuthMode === "sso"
                ? "Your account uses single sign-on. Verify your identity by confirming your recent login session."
                : "For security, please re-enter your password to continue. This protects sensitive health information."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex gap-2 text-sm">
              <Shield className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span className="text-amber-800 dark:text-amber-200">HIPAA-compliant session. All actions are audited.</span>
            </div>

            {reAuthMode === "password" ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="reauth-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="reauth-password"
                      type={showPassword ? "text" : "password"}
                      value={reAuthPassword}
                      onChange={e => setReAuthPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="pr-10"
                      data-testid="input-reauth-password"
                      aria-required="true"
                      onKeyDown={e => e.key === "Enter" && handleReAuth()}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button
                  variant="link"
                  size="sm"
                  className="px-0 text-xs"
                  onClick={() => { setReAuthMode("sso"); setReAuthPassword(""); }}
                  data-testid="button-switch-to-sso"
                >
                  Verify with SSO session instead
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-center py-2">
                  <p className="text-sm text-muted-foreground mb-3">
                    Click below to verify your identity using your current login session.
                    If your session is not recent enough, you will need to log out and log back in first.
                  </p>
                </div>
                <Button
                  variant="link"
                  size="sm"
                  className="px-0 text-xs"
                  onClick={() => { setReAuthMode("password"); }}
                  data-testid="button-switch-to-password"
                >
                  Use password instead
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReAuthOpen(false)} data-testid="button-cancel-reauth">Cancel</Button>
            <Button
              onClick={handleReAuth}
              disabled={
                (reAuthMode === "password" && !reAuthPassword.trim())
                || reAuthMutation.isPending
              }
              data-testid="button-confirm-reauth"
            >
              {reAuthMutation.isPending ? "Verifying..." : (reAuthMode === "sso" ? "Verify Session" : "Verify & Continue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Wizard Dialog */}
      <Dialog open={showWizard} onOpenChange={v => { if (!v) closeWizard(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-wizard">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" aria-hidden="true" />
              Add Family Member
            </DialogTitle>
            <DialogDescription>
              Step {currentStepIndex + 1} of {WIZARD_STEPS.length}: {WIZARD_STEPS[currentStepIndex]?.label}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-1 mb-4" role="progressbar" aria-valuenow={currentStepIndex + 1} aria-valuemin={1} aria-valuemax={WIZARD_STEPS.length}>
            {WIZARD_STEPS.map((s, i) => {
              const StepIcon = s.icon;
              const isDone = i < currentStepIndex;
              const isCurrent = i === currentStepIndex;
              return (
                <div key={s.key} className="flex items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                      isDone ? "bg-primary text-primary-foreground" : isCurrent ? "bg-primary/20 text-primary border-2 border-primary" : "bg-muted text-muted-foreground"
                    }`}
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    {isDone ? <Check className="h-4 w-4" /> : <StepIcon className="h-3.5 w-3.5" />}
                  </div>
                  {i < WIZARD_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 ${isDone ? "bg-primary" : "bg-muted"}`} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-4 py-2" role="form" aria-label={`Step: ${WIZARD_STEPS[currentStepIndex]?.label}`}>
            {wizardStep === "relationship" && (
              <fieldset className="space-y-4" aria-labelledby="step-relationship-label">
                <legend id="step-relationship-label" className="text-sm font-semibold mb-2">Select Profile Type &amp; Relationship</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(["child", "dependent_adult", "elder"] as ProfileType[]).map(type => {
                    const cfg = profileTypeConfig[type];
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => updateDraft({ profileType: type })}
                        className={`p-4 rounded-lg border text-left transition-colors ${
                          draft.profileType === type
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                        data-testid={`select-type-${type}`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
                          <div>
                            <p className="font-medium text-sm">{cfg.label}</p>
                            <p className="text-xs text-muted-foreground">{cfg.description}</p>
                          </div>
                          {draft.profileType === type && <Check className="h-4 w-4 text-primary ml-auto" aria-hidden="true" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wizard-relationship">Relationship to You</Label>
                  <Select value={draft.relationship} onValueChange={v => updateDraft({ relationship: v as RelationshipType })}>
                    <SelectTrigger id="wizard-relationship" data-testid="select-wizard-relationship">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(relationshipOptions).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </fieldset>
            )}

            {wizardStep === "identity" && (
              <fieldset className="space-y-4" aria-labelledby="step-identity-label">
                <legend id="step-identity-label" className="text-sm font-semibold mb-2">Personal Information</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="wizard-firstname">First Name *</Label>
                    <Input id="wizard-firstname" value={draft.firstName} onChange={e => updateDraft({ firstName: e.target.value })} placeholder="First name" aria-required="true" data-testid="input-wizard-firstname" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wizard-lastname">Last Name *</Label>
                    <Input id="wizard-lastname" value={draft.lastName} onChange={e => updateDraft({ lastName: e.target.value })} placeholder="Last name" aria-required="true" data-testid="input-wizard-lastname" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wizard-dob">Date of Birth *</Label>
                    <Input id="wizard-dob" type="date" value={draft.dateOfBirth} onChange={e => updateDraft({ dateOfBirth: e.target.value })} aria-required="true" data-testid="input-wizard-dob" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wizard-gender">Gender *</Label>
                    <Select value={draft.gender} onValueChange={v => updateDraft({ gender: v })}>
                      <SelectTrigger id="wizard-gender" data-testid="select-wizard-gender">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        {genderOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wizard-mrn">Medical Record Number</Label>
                    <Input id="wizard-mrn" value={draft.medicalRecordNumber} onChange={e => updateDraft({ medicalRecordNumber: e.target.value })} placeholder="MRN (optional)" data-testid="input-wizard-mrn" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wizard-insurance">Insurance ID</Label>
                    <Input id="wizard-insurance" value={draft.insuranceId} onChange={e => updateDraft({ insuranceId: e.target.value })} placeholder="Insurance ID (optional)" data-testid="input-wizard-insurance" />
                  </div>
                </div>
                <Separator />
                <p className="text-xs font-semibold text-muted-foreground uppercase">Emergency Contact (Optional)</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="wizard-ec-name">Name</Label>
                    <Input id="wizard-ec-name" value={draft.emergencyContactName} onChange={e => updateDraft({ emergencyContactName: e.target.value })} placeholder="Full name" data-testid="input-wizard-ec-name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wizard-ec-phone">Phone</Label>
                    <Input id="wizard-ec-phone" type="tel" value={draft.emergencyContactPhone} onChange={e => updateDraft({ emergencyContactPhone: e.target.value })} placeholder="(555) 123-4567" data-testid="input-wizard-ec-phone" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wizard-ec-rel">Relationship</Label>
                    <Input id="wizard-ec-rel" value={draft.emergencyContactRelationship} onChange={e => updateDraft({ emergencyContactRelationship: e.target.value })} placeholder="e.g., Parent" data-testid="input-wizard-ec-rel" />
                  </div>
                </div>
              </fieldset>
            )}

            {wizardStep === "verification" && (
              <fieldset className="space-y-4" aria-labelledby="step-verification-label">
                <legend id="step-verification-label" className="text-sm font-semibold mb-2">Legal Verification</legend>
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex gap-2 text-sm">
                  <Shield className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="text-amber-800 dark:text-amber-200">
                    Upload a legal document proving your relationship to {draft.firstName || "this person"}. This is required for HIPAA compliance.
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="wizard-doc-type">Document Type *</Label>
                    <Select value={draft.verificationDocType} onValueChange={v => updateDraft({ verificationDocType: v as VerificationDocType })}>
                      <SelectTrigger id="wizard-doc-type" data-testid="select-wizard-doc-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(verificationDocOptions).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wizard-doc-upload">Upload Document *</Label>
                    <Input
                      id="wizard-doc-upload"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={e => {
                        const file = e.target.files?.[0] || null;
                        updateDraft({ verificationDocFile: file, verificationDocName: file?.name || "" });
                      }}
                      className="cursor-pointer"
                      data-testid="input-wizard-doc-upload"
                      aria-required="true"
                    />
                  </div>
                </div>
                {draft.verificationDocName && (
                  <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20 p-2 rounded">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    <span>{draft.verificationDocName}</span>
                    <CheckCircle className="h-4 w-4 ml-auto" aria-hidden="true" />
                  </div>
                )}
                <Separator />
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="wizard-attestation"
                    checked={draft.attestation}
                    onCheckedChange={checked => updateDraft({ attestation: !!checked })}
                    data-testid="checkbox-wizard-attestation"
                    aria-required="true"
                  />
                  <Label htmlFor="wizard-attestation" className="text-sm leading-relaxed cursor-pointer">
                    I solemnly attest under penalty of law that I am the legal guardian, parent, spouse, or authorized representative of <strong>{draft.firstName || "this individual"} {draft.lastName}</strong> and have the legal authority to create and manage their health records. I understand this attestation may be verified. *
                  </Label>
                </div>
              </fieldset>
            )}

            {wizardStep === "health" && (
              <fieldset className="space-y-6" aria-labelledby="step-health-label">
                <legend id="step-health-label" className="text-sm font-semibold mb-2">Health Profile Quick Setup (Optional)</legend>
                <p className="text-sm text-muted-foreground">
                  Select any known conditions, medications, or allergies for {draft.firstName || "this family member"}. You can always add more later.
                </p>
                <QuickAddBadges
                  label="Conditions"
                  options={commonConditions}
                  selected={draft.conditions}
                  onToggle={item => toggleArrayItem("conditions", item)}
                  customPlaceholder="Add custom condition..."
                  testIdPrefix="condition"
                />
                <QuickAddBadges
                  label="Medications"
                  options={commonMedications}
                  selected={draft.medications}
                  onToggle={item => toggleArrayItem("medications", item)}
                  customPlaceholder="Add custom medication..."
                  testIdPrefix="medication"
                />
                <QuickAddBadges
                  label="Allergies"
                  options={commonAllergens}
                  selected={draft.allergies}
                  onToggle={item => toggleArrayItem("allergies", item)}
                  customPlaceholder="Add custom allergen..."
                  testIdPrefix="allergy"
                />
              </fieldset>
            )}

            {wizardStep === "confirmation" && createdProfile && (
              <div className="space-y-4 text-center py-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-bold" data-testid="text-confirmation-title">
                  {draft.firstName} {draft.lastName} Added!
                </h3>
                <p className="text-muted-foreground">
                  {profileTypeConfig[draft.profileType]?.label} profile has been created successfully.
                </p>
                <div className="text-left bg-muted/30 rounded-lg p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Name:</span> <strong>{draft.firstName} {draft.lastName}</strong></div>
                    <div><span className="text-muted-foreground">Type:</span> <strong>{profileTypeConfig[draft.profileType]?.label}</strong></div>
                    <div><span className="text-muted-foreground">Relationship:</span> <strong>{relationshipOptions[draft.relationship]}</strong></div>
                    <div><span className="text-muted-foreground">DOB:</span> <strong>{draft.dateOfBirth ? new Date(draft.dateOfBirth + "T00:00:00").toLocaleDateString() : "\u2014"}</strong></div>
                    {draft.conditions.length > 0 && <div className="col-span-2"><span className="text-muted-foreground">Conditions:</span> <strong>{draft.conditions.join(", ")}</strong></div>}
                    {draft.medications.length > 0 && <div className="col-span-2"><span className="text-muted-foreground">Medications:</span> <strong>{draft.medications.join(", ")}</strong></div>}
                    {draft.allergies.length > 0 && <div className="col-span-2"><span className="text-muted-foreground">Allergies:</span> <strong>{draft.allergies.join(", ")}</strong></div>}
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1" onClick={closeWizard} data-testid="button-done">
                    Done
                  </Button>
                  <Button className="flex-1" onClick={() => { setDraft(createEmptyDraft()); setWizardStep("relationship"); setCreatedProfile(null); }} data-testid="button-add-another">
                    <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                    Add Another
                  </Button>
                </div>
              </div>
            )}
          </div>

          {wizardStep !== "confirmation" && (
            <DialogFooter className="flex-row justify-between sm:justify-between">
              <Button
                variant="outline"
                onClick={currentStepIndex === 0 ? closeWizard : prevStep}
                data-testid="button-wizard-back"
              >
                {currentStepIndex === 0 ? "Cancel" : (
                  <>
                    <ChevronLeft className="h-4 w-4 mr-1" aria-hidden="true" />
                    Back
                  </>
                )}
              </Button>
              {wizardStep === "health" ? (
                <Button
                  onClick={handleSubmitWizard}
                  disabled={submitting}
                  data-testid="button-wizard-submit"
                >
                  {submitting ? "Creating Profile..." : (
                    <>
                      <Check className="h-4 w-4 mr-1" aria-hidden="true" />
                      Create Profile
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={nextStep}
                  disabled={!canProceed()}
                  data-testid="button-wizard-next"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Health Data Entry Dialog */}
      <Dialog open={healthEntryDialogOpen} onOpenChange={setHealthEntryDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto" data-testid="dialog-health-entry">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {healthEntryType === "conditions" && <Stethoscope className="h-5 w-5 text-primary" aria-hidden="true" />}
              {healthEntryType === "medications" && <Pill className="h-5 w-5 text-primary" aria-hidden="true" />}
              {healthEntryType === "allergies" && <Activity className="h-5 w-5 text-primary" aria-hidden="true" />}
              Add {healthEntryType.charAt(0).toUpperCase() + healthEntryType.slice(1)}
            </DialogTitle>
            <DialogDescription>
              Select or type {healthEntryType} to add for{" "}
              {profiles.find((p: FamilyProfile) => p.id === healthEntryMember)?.firstName || "this member"}{" "}
              {profiles.find((p: FamilyProfile) => p.id === healthEntryMember)?.lastName || ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <QuickAddBadges
              label={`Select ${healthEntryType}`}
              options={healthEntryOptions}
              selected={healthEntryItems}
              onToggle={toggleHealthEntryItem}
              customPlaceholder={`Add custom ${healthEntryType.slice(0, -1)}...`}
              testIdPrefix={`entry-${healthEntryType}`}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHealthEntryDialogOpen(false)} data-testid="button-cancel-health-entry">
              Cancel
            </Button>
            <Button
              onClick={submitHealthEntry}
              disabled={healthEntryItems.length === 0 || healthEntryMutation.isPending}
              data-testid="button-save-health-entry"
            >
              {healthEntryMutation.isPending ? "Saving..." : (
                <>
                  <Save className="h-4 w-4 mr-1" aria-hidden="true" />
                  Save {healthEntryItems.length} {healthEntryType}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MemberCard({ profile, isSelf, onViewData, onManageAccess, healthSummary }: {
  profile: FamilyProfile;
  isSelf?: boolean;
  onViewData: () => void;
  onManageAccess: () => void;
  healthSummary?: { conditions: number; medications: number; allergies: number; appointments: number };
}) {
  const cfg = profileTypeConfig[profile.profileType] || profileTypeConfig.self;
  const Icon = cfg.icon;
  const age = profile.dateOfBirth ? getAge(profile.dateOfBirth) : null;
  const relationLabel = profile.relationship && profile.relationship !== "self"
    ? (relationshipOptions[profile.relationship as RelationshipType] || profile.relationship)
    : null;

  return (
    <Card className={`hover:shadow-md transition-shadow ${isSelf ? "border-primary/30" : ""}`} data-testid={`member-card-${profile.id}`}>
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12 shrink-0">
            {profile.profileImageUrl && <AvatarImage src={profile.profileImageUrl} alt={profile.firstName} />}
            <AvatarFallback className={`${isSelf ? "bg-primary/20 text-primary" : "bg-muted"} text-sm font-medium`}>
              {getInitials(profile.firstName, profile.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate" data-testid={`text-name-${profile.id}`}>{profile.firstName} {profile.lastName}</h3>
              {isSelf && <Badge variant="secondary" className="text-xs shrink-0">You</Badge>}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{cfg.label}</span>
              {relationLabel && <span>· {relationLabel}</span>}
              {age !== null && <span>· {age} yrs</span>}
            </div>
            {healthSummary && (healthSummary.conditions > 0 || healthSummary.medications > 0 || healthSummary.allergies > 0) && (
              <div className="flex flex-wrap gap-1.5 mt-2" data-testid={`health-summary-${profile.id}`}>
                {healthSummary.conditions > 0 && (
                  <Badge variant="outline" className="text-xs py-0">
                    <Stethoscope className="h-3 w-3 mr-0.5" aria-hidden="true" />
                    {healthSummary.conditions}
                  </Badge>
                )}
                {healthSummary.medications > 0 && (
                  <Badge variant="outline" className="text-xs py-0">
                    <Pill className="h-3 w-3 mr-0.5" aria-hidden="true" />
                    {healthSummary.medications}
                  </Badge>
                )}
                {healthSummary.allergies > 0 && (
                  <Badge variant="outline" className="text-xs py-0">
                    <Activity className="h-3 w-3 mr-0.5" aria-hidden="true" />
                    {healthSummary.allergies}
                  </Badge>
                )}
                {healthSummary.appointments > 0 && (
                  <Badge variant="outline" className="text-xs py-0">
                    <Calendar className="h-3 w-3 mr-0.5" aria-hidden="true" />
                    {healthSummary.appointments}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" size="sm" className="flex-1 min-h-[36px]" onClick={onViewData} data-testid={`button-view-data-${profile.id}`}>
            <Activity className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
            Health Data
          </Button>
          {!isSelf && (
            <Button variant="outline" size="sm" className="min-h-[36px]" onClick={onManageAccess} data-testid={`button-manage-access-${profile.id}`}>
              <Shield className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
              Access
            </Button>
          )}
          <Button variant="ghost" size="sm" className="min-h-[36px]" onClick={onManageAccess} data-testid={`button-manage-${profile.id}`}>
            <Settings className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function HealthDataColumn({
  title,
  icon: Icon,
  entryType,
  members,
  healthDataMap,
  onAddEntry,
}: {
  title: string;
  icon: typeof Pill;
  entryType: HealthEntryType;
  members: FamilyProfile[];
  healthDataMap: Record<string, FamilyHealthData>;
  onAddEntry: (profileId: string, type: HealthEntryType) => void;
}) {
  return (
    <Card data-testid={`data-card-${entryType}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {members.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">No members selected</p>
        ) : (
          members.map((m: FamilyProfile) => {
            const data = healthDataMap[m.id];
            const items: string[] = data?.[entryType] || [];
            return (
              <div key={m.id} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{m.firstName} {m.lastName}</p>
                {items.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {items.map((item: string) => (
                      <Badge key={item} variant="outline" className="text-xs">
                        {item}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No {entryType} recorded</p>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full min-h-[32px] text-xs"
                  onClick={() => onAddEntry(m.id, entryType)}
                  data-testid={`button-add-${entryType}-${m.id}`}
                >
                  <Plus className="h-3 w-3 mr-1" aria-hidden="true" />
                  Add {title}
                </Button>
                <Separator className="last:hidden" />
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
