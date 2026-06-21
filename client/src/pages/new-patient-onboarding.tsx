import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AIOnboardingAgent } from "@/components/ai-onboarding-agent";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  User,
  Shield,
  BookOpen,
  Sparkles,
  Loader2,
  Heart,
  FileText,
  BarChart3,
  MessageSquare,
  Settings,
  Bell,
  Search,
  Calendar,
  Pill,
  Activity,
  Lock,
  Link2,
  CheckCircle,
  ExternalLink,
  ShieldCheck,
  SkipForward,
} from "lucide-react";

const STEPS = [
  { id: "welcome", label: "Welcome", icon: Sparkles },
  { id: "profile", label: "Profile Setup", icon: User },
  { id: "consent", label: "Data Consent", icon: Shield },
  { id: "connect", label: "Connect Records", icon: Link2 },
  { id: "tutorial", label: "Portal Tour", icon: BookOpen },
];

interface ProfileData {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  email: string;
  phone: string;
  address: { street: string; city: string; state: string; zipCode: string };
  preferredLanguage: string;
  communicationPreference: string;
  timezone: string;
  ssnLast4: string;
  stateIdNumber: string;
  stateIdIssuingState: string;
  emergencyContact: { name: string; relationship: string; phone: string; email: string };
  insurance: { planName: string; memberId: string; groupNumber: string };
  race: string;
  ethnicity: string;
  preferredPharmacy: { name: string; address: string; phone: string };
}

interface ConsentData {
  healthDataSharing: boolean;
  aiAnalysis: boolean;
  researchParticipation: boolean;
  thirdPartySharing: boolean;
  marketingCommunications: boolean;
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-1" data-testid="step-indicator">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const isActive = i === currentStep;
        const isComplete = i < currentStep;
        return (
          <div key={step.id} className="flex items-center gap-1">
            {i > 0 && (
              <div className={`h-0.5 w-6 sm:w-10 ${isComplete ? "bg-primary" : "bg-muted"}`} />
            )}
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : isComplete
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-muted bg-muted/30 text-muted-foreground"
              }`}
            >
              {isComplete ? (
                <Check className="w-4 h-4" />
              ) : (
                <Icon className="w-3.5 h-3.5" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WelcomeStep() {
  return (
    <div className="space-y-6 text-center py-4" data-testid="step-welcome">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
        <Heart className="w-10 h-10 text-primary" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold" data-testid="text-welcome-title">
          Welcome to Tabula Medica
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          We are here to help you take control of your health records. This quick setup will get you started in just a few minutes.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto text-left">
        <Card>
          <CardContent className="pt-4 pb-3 px-3">
            <User className="w-5 h-5 text-primary mb-1.5" />
            <p className="text-xs font-medium">Create Your Profile</p>
            <p className="text-xs text-muted-foreground">Basic info so we can personalize your experience</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-3">
            <Shield className="w-5 h-5 text-primary mb-1.5" />
            <p className="text-xs font-medium">Set Your Preferences</p>
            <p className="text-xs text-muted-foreground">Control how your health data is used</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-3">
            <BookOpen className="w-5 h-5 text-primary mb-1.5" />
            <p className="text-xs font-medium">Quick Portal Tour</p>
            <p className="text-xs text-muted-foreground">Learn to navigate your health dashboard</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProfileStep({
  data,
  onChange,
}: {
  data: ProfileData;
  onChange: (d: ProfileData) => void;
}) {
  const update = <K extends keyof ProfileData>(key: K, val: ProfileData[K]) => {
    onChange({ ...data, [key]: val });
  };
  const updateAddress = (key: string, val: string) => {
    onChange({ ...data, address: { ...data.address, [key]: val } });
  };
  const updateEmergencyContact = (key: string, val: string) => {
    onChange({ ...data, emergencyContact: { ...data.emergencyContact, [key]: val } });
  };
  const updateInsurance = (key: string, val: string) => {
    onChange({ ...data, insurance: { ...data.insurance, [key]: val } });
  };
  const updatePharmacy = (key: string, val: string) => {
    onChange({ ...data, preferredPharmacy: { ...data.preferredPharmacy, [key]: val } });
  };

  const US_STATES = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
    "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
    "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
    "VA","WA","WV","WI","WY","DC",
  ];

  return (
    <div className="space-y-5" data-testid="step-profile">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label htmlFor="firstName">First Name *</Label>
          <Input
            id="firstName"
            data-testid="input-first-name"
            value={data.firstName}
            onChange={(e) => update("firstName", e.target.value)}
            placeholder="First name"
          />
        </div>
        <div>
          <Label htmlFor="middleName" className="flex items-center gap-1">
            Middle Name *
            <span className="text-xs text-muted-foreground">(USCDI)</span>
          </Label>
          <div className="flex gap-1">
            <Input
              id="middleName"
              data-testid="input-middle-name"
              value={data.middleName}
              onChange={(e) => update("middleName", e.target.value)}
              placeholder="Middle name"
              className="flex-1"
            />
            <Button
              type="button"
              variant={data.middleName === "NMN" ? "default" : "outline"}
              size="sm"
              onClick={() => update("middleName", "NMN")}
              data-testid="button-nmn"
              title="No Middle Name"
            >
              NMN
            </Button>
          </div>
        </div>
        <div>
          <Label htmlFor="lastName">Last Name *</Label>
          <Input
            id="lastName"
            data-testid="input-last-name"
            value={data.lastName}
            onChange={(e) => update("lastName", e.target.value)}
            placeholder="Last name"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="dob">Date of Birth *</Label>
          <Input
            id="dob"
            data-testid="input-dob"
            type="date"
            value={data.dateOfBirth}
            onChange={(e) => update("dateOfBirth", e.target.value)}
          />
        </div>
        <div>
          <Label>Gender *</Label>
          <Select value={data.gender} onValueChange={(v) => update("gender", v)}>
            <SelectTrigger data-testid="select-gender">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="non-binary">Non-binary</SelectItem>
              <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            data-testid="input-email"
            type="email"
            value={data.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <Label htmlFor="phone">Phone *</Label>
          <Input
            id="phone"
            data-testid="input-phone"
            type="tel"
            value={data.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="(555) 123-4567"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="street">Street Address</Label>
        <Input
          id="street"
          data-testid="input-street"
          value={data.address.street}
          onChange={(e) => updateAddress("street", e.target.value)}
          placeholder="123 Main St"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            data-testid="input-city"
            value={data.address.city}
            onChange={(e) => updateAddress("city", e.target.value)}
            placeholder="City"
          />
        </div>
        <div>
          <Label htmlFor="state">State</Label>
          <Input
            id="state"
            data-testid="input-state"
            value={data.address.state}
            onChange={(e) => updateAddress("state", e.target.value)}
            placeholder="State"
          />
        </div>
        <div>
          <Label htmlFor="zip">ZIP Code</Label>
          <Input
            id="zip"
            data-testid="input-zip"
            value={data.address.zipCode}
            onChange={(e) => updateAddress("zipCode", e.target.value)}
            placeholder="12345"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Preferred Language</Label>
          <Select value={data.preferredLanguage} onValueChange={(v) => update("preferredLanguage", v)}>
            <SelectTrigger data-testid="select-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="English">English</SelectItem>
              <SelectItem value="Spanish">Spanish</SelectItem>
              <SelectItem value="French">French</SelectItem>
              <SelectItem value="Mandarin">Mandarin</SelectItem>
              <SelectItem value="Arabic">Arabic</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Communication Preference</Label>
          <Select value={data.communicationPreference} onValueChange={(v) => update("communicationPreference", v)}>
            <SelectTrigger data-testid="select-comm-pref">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="portal">Portal Messages</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="phone">Phone</SelectItem>
              <SelectItem value="sms">Text / SMS</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border-t pt-4 mt-4">
        <p className="text-sm font-medium mb-1">Race & Ethnicity</p>
        <p className="text-xs text-muted-foreground mb-3">USCDI required fields — optional but helps improve care quality reporting</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Race</Label>
            <Select value={data.race} onValueChange={(v) => update("race", v)}>
              <SelectTrigger data-testid="select-race">
                <SelectValue placeholder="Select (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="american_indian_alaska_native">American Indian or Alaska Native</SelectItem>
                <SelectItem value="asian">Asian</SelectItem>
                <SelectItem value="black_african_american">Black or African American</SelectItem>
                <SelectItem value="native_hawaiian_pacific_islander">Native Hawaiian or Other Pacific Islander</SelectItem>
                <SelectItem value="white">White</SelectItem>
                <SelectItem value="two_or_more">Two or More Races</SelectItem>
                <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ethnicity</Label>
            <Select value={data.ethnicity} onValueChange={(v) => update("ethnicity", v)}>
              <SelectTrigger data-testid="select-ethnicity">
                <SelectValue placeholder="Select (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hispanic_latino">Hispanic or Latino</SelectItem>
                <SelectItem value="not_hispanic_latino">Not Hispanic or Latino</SelectItem>
                <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="border-t pt-4 mt-4">
        <p className="text-sm font-medium mb-1">Identification</p>
        <p className="text-xs text-muted-foreground mb-3">Optional — used for record matching and deduplication</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label htmlFor="ssnLast4">SSN Last 4 Digits</Label>
            <Input
              id="ssnLast4"
              data-testid="input-ssn-last4"
              value={data.ssnLast4}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                update("ssnLast4", val);
              }}
              placeholder="1234"
              maxLength={4}
              inputMode="numeric"
            />
          </div>
          <div>
            <Label htmlFor="stateIdNumber">State ID / Driver's License</Label>
            <Input
              id="stateIdNumber"
              data-testid="input-state-id"
              value={data.stateIdNumber}
              onChange={(e) => update("stateIdNumber", e.target.value)}
              placeholder="License number"
            />
          </div>
          <div>
            <Label>Issuing State</Label>
            <Select value={data.stateIdIssuingState} onValueChange={(v) => update("stateIdIssuingState", v)}>
              <SelectTrigger data-testid="select-issuing-state">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="border-t pt-4 mt-4">
        <p className="text-sm font-medium mb-1">Emergency Contact</p>
        <p className="text-xs text-muted-foreground mb-3">Optional — someone to reach in case of emergency</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ecName">Contact Name</Label>
            <Input
              id="ecName"
              data-testid="input-ec-name"
              value={data.emergencyContact.name}
              onChange={(e) => updateEmergencyContact("name", e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div>
            <Label>Relationship</Label>
            <Select value={data.emergencyContact.relationship} onValueChange={(v) => updateEmergencyContact("relationship", v)}>
              <SelectTrigger data-testid="select-ec-relationship">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="spouse">Spouse</SelectItem>
                <SelectItem value="parent">Parent</SelectItem>
                <SelectItem value="child">Child</SelectItem>
                <SelectItem value="sibling">Sibling</SelectItem>
                <SelectItem value="friend">Friend</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ecPhone">Contact Phone</Label>
            <Input
              id="ecPhone"
              data-testid="input-ec-phone"
              type="tel"
              value={data.emergencyContact.phone}
              onChange={(e) => updateEmergencyContact("phone", e.target.value)}
              placeholder="(555) 123-4567"
            />
          </div>
          <div>
            <Label htmlFor="ecEmail">Contact Email</Label>
            <Input
              id="ecEmail"
              data-testid="input-ec-email"
              type="email"
              value={data.emergencyContact.email}
              onChange={(e) => updateEmergencyContact("email", e.target.value)}
              placeholder="contact@example.com"
            />
          </div>
        </div>
      </div>

      <div className="border-t pt-4 mt-4">
        <p className="text-sm font-medium mb-1">Insurance Information</p>
        <p className="text-xs text-muted-foreground mb-3">Optional — helps with claims and coverage verification</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label htmlFor="planName">Plan Name</Label>
            <Input
              id="planName"
              data-testid="input-plan-name"
              value={data.insurance.planName}
              onChange={(e) => updateInsurance("planName", e.target.value)}
              placeholder="e.g. Blue Cross PPO"
            />
          </div>
          <div>
            <Label htmlFor="memberId">Member ID</Label>
            <Input
              id="memberId"
              data-testid="input-member-id"
              value={data.insurance.memberId}
              onChange={(e) => updateInsurance("memberId", e.target.value)}
              placeholder="Member ID"
            />
          </div>
          <div>
            <Label htmlFor="groupNumber">Group Number</Label>
            <Input
              id="groupNumber"
              data-testid="input-group-number"
              value={data.insurance.groupNumber}
              onChange={(e) => updateInsurance("groupNumber", e.target.value)}
              placeholder="Group #"
            />
          </div>
        </div>
      </div>

      <div className="border-t pt-4 mt-4">
        <p className="text-sm font-medium mb-1">Preferred Pharmacy</p>
        <p className="text-xs text-muted-foreground mb-3">Optional — where you'd like prescriptions sent</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label htmlFor="pharmacyName">Pharmacy Name</Label>
            <Input
              id="pharmacyName"
              data-testid="input-pharmacy-name"
              value={data.preferredPharmacy.name}
              onChange={(e) => updatePharmacy("name", e.target.value)}
              placeholder="e.g. CVS Pharmacy"
            />
          </div>
          <div>
            <Label htmlFor="pharmacyAddress">Pharmacy Address</Label>
            <Input
              id="pharmacyAddress"
              data-testid="input-pharmacy-address"
              value={data.preferredPharmacy.address}
              onChange={(e) => updatePharmacy("address", e.target.value)}
              placeholder="123 Pharmacy Ave"
            />
          </div>
          <div>
            <Label htmlFor="pharmacyPhone">Pharmacy Phone</Label>
            <Input
              id="pharmacyPhone"
              data-testid="input-pharmacy-phone"
              type="tel"
              value={data.preferredPharmacy.phone}
              onChange={(e) => updatePharmacy("phone", e.target.value)}
              placeholder="(555) 987-6543"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ConsentStep({
  data,
  onChange,
}: {
  data: ConsentData;
  onChange: (d: ConsentData) => void;
}) {
  const toggle = (key: keyof ConsentData) => {
    onChange({ ...data, [key]: !data[key] });
  };

  const consentItems = [
    {
      key: "healthDataSharing" as const,
      label: "Health Data Sharing",
      description:
        "Allow your health records from connected EHR systems to be aggregated and displayed in your unified health timeline.",
      required: true,
      icon: Heart,
    },
    {
      key: "aiAnalysis" as const,
      label: "AI-Powered Analysis",
      description:
        "Enable AI to analyze your health data to provide personalized insights, medication reminders, and health recommendations. No data leaves the platform.",
      required: false,
      icon: Sparkles,
    },
    {
      key: "researchParticipation" as const,
      label: "Research Participation",
      description:
        "Optionally contribute de-identified health data to medical research studies that may improve healthcare outcomes.",
      required: false,
      icon: BarChart3,
    },
    {
      key: "thirdPartySharing" as const,
      label: "Provider Data Sharing",
      description:
        "Allow sharing of your health data with healthcare providers you have explicitly authorized for care coordination.",
      required: false,
      icon: FileText,
    },
    {
      key: "marketingCommunications" as const,
      label: "Health Communications",
      description:
        "Receive helpful health tips, preventive care reminders, and wellness content tailored to your health profile.",
      required: false,
      icon: Bell,
    },
  ];

  return (
    <div className="space-y-4" data-testid="step-consent">
      <div className="p-3 rounded-md bg-muted/50 border">
        <div className="flex items-start gap-2">
          <Lock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Your privacy matters. All data is encrypted and HIPAA-compliant. You can change
            these settings at any time from your account preferences.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {consentItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.key}
              className="flex items-start gap-3 p-3 rounded-md border"
              data-testid={`consent-item-${item.key}`}
            >
              <Icon className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.required && (
                    <Badge variant="secondary">Required</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.description}
                </p>
              </div>
              <Switch
                checked={data[item.key]}
                onCheckedChange={() => toggle(item.key)}
                disabled={item.required && data[item.key]}
                data-testid={`switch-${item.key}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConnectHealthRecordsStep({
  onConnect,
  onSkip,
  isConnecting,
}: {
  onConnect: () => void;
  onSkip: () => void;
  isConnecting: boolean;
}) {
  const { data: connectionsData } = useQuery<{
    success: boolean;
    connections: Array<{ id: string; platform: string; status: string; displayName: string }>;
  }>({
    queryKey: ["/api/ehr/connections"],
    refetchInterval: 5000,
  });

  const connections = connectionsData?.connections || [];
  const hasActiveConnection = connections.some((c) => c.status === "connected");

  return (
    <div className="space-y-5" data-testid="step-connect-records">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Link2 className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-base font-semibold" data-testid="text-connect-title">
          Connect Your Health Records
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Import your medical records from hospitals, clinics, and other healthcare providers automatically using Fasten Health.
        </p>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Secure Identity Verification</p>
              <p className="text-xs text-muted-foreground">
                Fasten Health uses Clear or ID.me to verify your identity before connecting to your health records. This ensures only you can access your data.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Automatic Record Import</p>
              <p className="text-xs text-muted-foreground">
                Once connected, your conditions, medications, lab results, immunizations, and more are imported and merged with your profile.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">HIPAA-Compliant & Encrypted</p>
              <p className="text-xs text-muted-foreground">
                All data transfers are encrypted end-to-end and fully HIPAA-compliant. Your records are never shared without your explicit consent.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {hasActiveConnection ? (
        <div className="p-3 rounded-md bg-primary/5 border border-primary/20" data-testid="status-connected">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium">Health Records Connected</p>
              <p className="text-xs text-muted-foreground">
                {connections.filter((c) => c.status === "connected").length} source(s) connected successfully. Your records are being imported.
              </p>
            </div>
          </div>
          <div className="mt-2 space-y-1">
            {connections
              .filter((c) => c.status === "connected")
              .map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Check className="w-3 h-3 text-primary" />
                  <span>{c.displayName}</span>
                  <Badge variant="secondary">{c.platform}</Badge>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <Button
            onClick={onConnect}
            disabled={isConnecting}
            data-testid="button-connect-fasten"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Connecting...
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4 mr-1.5" /> Connect via Fasten Health
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={onSkip}
            data-testid="button-skip-connect"
          >
            <SkipForward className="w-4 h-4 mr-1.5" /> Skip for Now
          </Button>
          <p className="text-xs text-muted-foreground text-center max-w-sm">
            You can always connect your health records later from the Settings page.
          </p>
        </div>
      )}
    </div>
  );
}

function TutorialStep({ onComplete }: { onComplete: () => void }) {
  const [activeFeature, setActiveFeature] = useState(0);

  const features = [
    {
      icon: Activity,
      title: "Health Dashboard",
      description:
        "Your home base. See vital signs, recent lab results, upcoming appointments, and health alerts all in one view.",
      detail: "Navigate to the Dashboard from the sidebar to get a quick overview of your current health status.",
    },
    {
      icon: FileText,
      title: "Health Records",
      description:
        "All your medical records from every connected provider, organized in a unified timeline.",
      detail: "Access your conditions, medications, lab results, and immunization history in the Records section.",
    },
    {
      icon: Pill,
      title: "Medications",
      description:
        "Track all your medications with dosage information, refill reminders, and drug interaction alerts.",
      detail: "The Medications tab shows active prescriptions and lets you set up personalized reminders.",
    },
    {
      icon: Calendar,
      title: "Appointments",
      description:
        "View and manage upcoming appointments across all your healthcare providers.",
      detail: "Book new appointments, join telehealth visits, and review past visit summaries.",
    },
    {
      icon: MessageSquare,
      title: "Secure Messaging",
      description:
        "Communicate securely with your care team through encrypted, HIPAA-compliant messaging.",
      detail: "Send questions to your doctors, share test results, and receive care instructions.",
    },
    {
      icon: Search,
      title: "AI Health Assistant",
      description:
        "Ask questions about your health data in plain language and get instant, personalized answers.",
      detail: "The AI assistant can explain lab results, summarize records, and help you prepare for appointments.",
    },
    {
      icon: Settings,
      title: "Settings & Privacy",
      description:
        "Control your data sharing preferences, manage connected devices, and update your profile.",
      detail: "Access privacy settings, consent management, and notification preferences from the Settings page.",
    },
  ];

  return (
    <div className="space-y-4" data-testid="step-tutorial">
      <p className="text-sm text-muted-foreground text-center">
        Here is a quick overview of the key features available to you. Tap each feature to learn more.
      </p>

      <Progress value={((activeFeature + 1) / features.length) * 100} className="h-1.5" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {features.map((feature, i) => {
          const Icon = feature.icon;
          return (
            <button
              key={i}
              onClick={() => setActiveFeature(i)}
              className={`p-2.5 rounded-md border text-left transition-colors ${
                i === activeFeature
                  ? "border-primary bg-primary/5"
                  : "hover-elevate"
              }`}
              data-testid={`tutorial-feature-${i}`}
            >
              <Icon className={`w-4 h-4 mb-1 ${i === activeFeature ? "text-primary" : "text-muted-foreground"}`} />
              <p className="text-xs font-medium truncate">{feature.title}</p>
            </button>
          );
        })}
      </div>

      <Card className={activeFeature >= 0 ? "border-primary/20" : ""}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            {(() => {
              const Icon = features[activeFeature].icon;
              return (
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
              );
            })()}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold" data-testid="text-feature-title">
                {features[activeFeature].title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {features[activeFeature].description}
              </p>
              <p className="text-xs text-muted-foreground/80 italic">
                {features[activeFeature].detail}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setActiveFeature(Math.max(0, activeFeature - 1))}
          disabled={activeFeature === 0}
          data-testid="button-prev-feature"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Previous
        </Button>
        {activeFeature < features.length - 1 ? (
          <Button
            size="sm"
            onClick={() => setActiveFeature(activeFeature + 1)}
            data-testid="button-next-feature"
          >
            Next Feature <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={onComplete}
            data-testid="button-finish-tour"
          >
            <Check className="w-3.5 h-3.5 mr-1" /> Finish Tour
          </Button>
        )}
      </div>
    </div>
  );
}

export default function NewPatientOnboarding() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [tutorialDone, setTutorialDone] = useState(false);

  const [profile, setProfile] = useState<ProfileData>({
    firstName: "",
    middleName: "NMN",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    email: "",
    phone: "",
    address: { street: "", city: "", state: "", zipCode: "" },
    preferredLanguage: "English",
    communicationPreference: "portal",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
    ssnLast4: "",
    stateIdNumber: "",
    stateIdIssuingState: "",
    emergencyContact: { name: "", relationship: "", phone: "", email: "" },
    insurance: { planName: "", memberId: "", groupNumber: "" },
    race: "",
    ethnicity: "",
    preferredPharmacy: { name: "", address: "", phone: "" },
  });

  const [consent, setConsent] = useState<ConsentData>({
    healthDataSharing: true,
    aiAnalysis: false,
    researchParticipation: false,
    thirdPartySharing: false,
    marketingCommunications: false,
  });

  const handleAutoFill = useCallback((data: { firstName?: string; middleName?: string; lastName?: string; dateOfBirth?: string; gender?: string; email?: string; phone?: string; address?: { street?: string; city?: string; state?: string; zipCode?: string } }) => {
    setProfile((prev) => {
      const merged = { ...prev };
      const d = data;
      if (d.firstName && !prev.firstName.trim()) merged.firstName = d.firstName;
      if (d.middleName && (!prev.middleName.trim() || prev.middleName === "NMN")) merged.middleName = d.middleName;
      if (d.lastName && !prev.lastName.trim()) merged.lastName = d.lastName;
      if (d.dateOfBirth && !prev.dateOfBirth) merged.dateOfBirth = d.dateOfBirth;
      if (d.gender && !prev.gender) merged.gender = d.gender;
      if (d.email && !prev.email.trim()) merged.email = d.email;
      if (d.phone && !prev.phone.trim()) merged.phone = d.phone;
      if (d.address) {
        merged.address = {
          street: (d.address.street && !prev.address.street.trim()) ? d.address.street : prev.address.street,
          city: (d.address.city && !prev.address.city.trim()) ? d.address.city : prev.address.city,
          state: (d.address.state && !prev.address.state.trim()) ? d.address.state : prev.address.state,
          zipCode: (d.address.zipCode && !prev.address.zipCode.trim()) ? d.address.zipCode : prev.address.zipCode,
        };
      }
      return merged;
    });
  }, []);

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/new-patient-onboarding/start");
      return res.json();
    },
  });

  const profileMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/new-patient-onboarding/profile", profile);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Profile saved", description: "Your profile has been created successfully." });
      setCurrentStep(2);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save profile. Please check the fields and try again.", variant: "destructive" });
    },
  });

  const [ehrConnecting, setEhrConnecting] = useState(false);

  const consentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/new-patient-onboarding/consent", consent);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Preferences saved", description: "Your data usage preferences have been recorded." });
      setCurrentStep(3);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save preferences. Please try again.", variant: "destructive" });
    },
  });

  const tutorialMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/new-patient-onboarding/tutorial-complete");
      return res.json();
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/new-patient-onboarding/complete");
      return res.json();
    },
    onSuccess: () => {
      setCompleted(true);
      toast({ title: "All set!", description: "Your onboarding is complete. Welcome to Tabula Medica!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    },
  });

  const validateProfile = useCallback((): string | null => {
    if (!profile.firstName.trim()) return "First name is required";
    if (!profile.lastName.trim()) return "Last name is required";
    if (!profile.dateOfBirth) return "Date of birth is required";
    if (!profile.gender) return "Gender is required";
    if (!profile.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email))
      return "A valid email address is required";
    if (!profile.phone.trim()) return "Phone number is required";
    return null;
  }, [profile]);

  const handleConnectEhr = async () => {
    setEhrConnecting(true);
    try {
      window.location.href = "/fasten-connect";
    } catch {
      toast({
        title: "Unable to connect",
        description: "Could not initiate the Fasten Health connection. You can try again later from Settings.",
        variant: "destructive",
      });
      setEhrConnecting(false);
    }
  };

  const handleSkipConnect = () => {
    setCurrentStep(4);
  };

  const handleNext = () => {
    if (currentStep === 0) {
      startMutation.mutate();
      setCurrentStep(1);
    } else if (currentStep === 1) {
      const validationError = validateProfile();
      if (validationError) {
        toast({
          title: "Required fields missing",
          description: validationError,
          variant: "destructive",
        });
        return;
      }
      profileMutation.mutate();
    } else if (currentStep === 2) {
      if (!consent.healthDataSharing) {
        toast({
          title: "Required consent",
          description: "Health Data Sharing consent is required to use the platform.",
          variant: "destructive",
        });
        return;
      }
      consentMutation.mutate();
    } else if (currentStep === 3) {
      setCurrentStep(4);
    }
  };

  const handleTutorialComplete = () => {
    setTutorialDone(true);
    tutorialMutation.mutate();
  };

  const handleFinish = () => {
    completeMutation.mutate();
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const isPending =
    profileMutation.isPending ||
    consentMutation.isPending ||
    completeMutation.isPending;

  if (completed) {
    return (
      <ScrollArea className="h-full">
        <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6" data-testid="onboarding-complete">
          <Card className="border-primary/30">
            <CardContent className="pt-8 pb-6 text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Check className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-xl font-semibold" data-testid="text-complete-title">
                You are All Set!
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Welcome, {profile.firstName}! Your profile is set up and your preferences are saved. You are ready to explore your health dashboard.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <Card>
                  <CardContent className="pt-3 pb-3 px-3 text-center">
                    <Check className="w-5 h-5 text-primary mx-auto mb-1" />
                    <p className="text-xs font-medium">Profile Created</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-3 pb-3 px-3 text-center">
                    <Check className="w-5 h-5 text-primary mx-auto mb-1" />
                    <p className="text-xs font-medium">Consent Recorded</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-3 pb-3 px-3 text-center">
                    <Check className="w-5 h-5 text-primary mx-auto mb-1" />
                    <p className="text-xs font-medium">Tour Completed</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              onClick={() => navigate("/patient-portal")}
              data-testid="button-go-portal"
            >
              Go to Patient Portal
            </Button>
            <Button
              onClick={() => navigate("/")}
              data-testid="button-go-dashboard"
            >
              Open Dashboard
            </Button>
          </div>
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => navigate("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold" data-testid="text-page-title">
              New Patient Setup
            </h1>
            <p className="text-xs text-muted-foreground">
              Step {currentStep + 1} of {STEPS.length}
            </p>
          </div>
          <StepIndicator currentStep={currentStep} />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {(() => {
                const Icon = STEPS[currentStep].icon;
                return <Icon className="w-4.5 h-4.5 text-primary" />;
              })()}
              {STEPS[currentStep].label}
            </CardTitle>
            <CardDescription>
              {currentStep === 0 && "Get started with your patient account"}
              {currentStep === 1 && "Tell us about yourself so we can personalize your experience"}
              {currentStep === 2 && "Choose how your health data is used"}
              {currentStep === 3 && "Import your existing medical records securely"}
              {currentStep === 4 && "Explore the key features of your patient portal"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentStep === 0 && <WelcomeStep />}
            {currentStep === 1 && (
              <ProfileStep data={profile} onChange={setProfile} />
            )}
            {currentStep === 2 && (
              <ConsentStep data={consent} onChange={setConsent} />
            )}
            {currentStep === 3 && (
              <ConnectHealthRecordsStep
                onConnect={handleConnectEhr}
                onSkip={handleSkipConnect}
                isConnecting={ehrConnecting}
              />
            )}
            {currentStep === 4 && (
              <TutorialStep onComplete={handleTutorialComplete} />
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentStep === 0 || isPending}
            data-testid="button-prev-step"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>

          {currentStep < 4 ? (
            <Button
              onClick={handleNext}
              disabled={isPending}
              data-testid="button-next-step"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  {currentStep === 0 ? "Get Started" : "Continue"}{" "}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleFinish}
              disabled={!tutorialDone || isPending}
              data-testid="button-complete-onboarding"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Finishing...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-1" /> Complete Setup
                </>
              )}
            </Button>
          )}
        </div>
      </div>
      <AIOnboardingAgent
        currentStep={STEPS[currentStep].id}
        profileData={profile as unknown as Record<string, unknown>}
        onAutoFill={handleAutoFill}
      />
    </ScrollArea>
  );
}
