import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSEO } from "@/hooks/use-seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Heart,
  Stethoscope,
  Ambulance,
  FileText,
  Ribbon,
  GraduationCap,
  Users,
  Pill,
  ShieldAlert,
  Activity,
  Calendar,
  ImageIcon,
  TestTube2,
  BookOpen,
  FileWarning,
  Download,
  Link2,
  Clock,
  Lock,
  Copy,
  CheckCircle2,
  Info,
  Loader2,
  Eye,
  User,
  Phone,
  UserCheck,
  ClipboardList,
  CalendarDays,
} from "lucide-react";
import type { ProfileSummary } from "@shared/schema";

type PacketType = 
  | "emergency" 
  | "new_doctor" 
  | "er" 
  | "referral" 
  | "cancer" 
  | "school_camp" 
  | "caregiver";

type TimeRange = "3mo" | "12mo" | "all" | "custom";
type ExpirationOption = "24h" | "7d" | "30d";
type AccessControl = "anyone" | "pin_required";

interface PacketConfig {
  type: PacketType;
  includeDemographics: boolean;
  includeMedications: boolean;
  includeAllergies: boolean;
  includeConditions: boolean;
  includeEmergencyContact: boolean;
  includeCaregiverContact: boolean;
  includeVisitSummaries: boolean;
  includeImagingReports: boolean;
  includeLabs: boolean;
  includeCancerBasics: boolean;
  includeTreatmentTimeline: boolean;
  includeFollowUpSchedule: boolean;
  includeSideEffectsJournal: boolean;
  timeRange: TimeRange;
}

interface PacketPreview {
  sections: string[];
  documentCount: number;
  estimatedPages: number;
}

const packetTypes: { 
  type: PacketType; 
  label: string; 
  description: string; 
  icon: typeof Heart;
  condition?: "cancer" | "child";
  acoPreset?: boolean;
  estimatedPages?: string;
}[] = [
  { type: "er", label: "ED Packet (ACO)", description: "1 page - Emergency Department essentials", icon: Ambulance, acoPreset: true, estimatedPages: "1 page" },
  { type: "referral", label: "Specialist Packet (ACO)", description: "2-3 pages - Specialist referral summary", icon: Stethoscope, acoPreset: true, estimatedPages: "2-3 pages" },
  { type: "emergency", label: "Emergency Packet", description: "1-page critical info for emergencies", icon: AlertTriangle },
  { type: "new_doctor", label: "New Doctor Packet", description: "Complete history for new providers", icon: Stethoscope },
  { type: "cancer", label: "Cancer Packet", description: "Multi-page treatment summary", icon: Ribbon, condition: "cancer" },
  { type: "school_camp", label: "School/Camp Packet", description: "For school or camp forms", icon: GraduationCap, condition: "child" },
  { type: "caregiver", label: "Caregiver Packet", description: "Info for caregivers", icon: Users },
];

const timeRangeOptions: { value: TimeRange; label: string }[] = [
  { value: "3mo", label: "Last 3 months" },
  { value: "12mo", label: "Last 12 months" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom range" },
];

const expirationOptions: { value: ExpirationOption; label: string }[] = [
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

export default function PacketExport() {
  useSEO({
    title: "Export Packet | Tabula Medica",
    description: "Create and share health record packets securely",
  });

  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<PacketConfig>({
    type: "emergency",
    includeDemographics: true,
    includeMedications: true,
    includeAllergies: true,
    includeConditions: true,
    includeEmergencyContact: true,
    includeCaregiverContact: true,
    includeVisitSummaries: true,
    includeImagingReports: false,
    includeLabs: false,
    includeCancerBasics: true,
    includeTreatmentTimeline: true,
    includeFollowUpSchedule: true,
    includeSideEffectsJournal: false,
    timeRange: "12mo",
  });
  const [expiration, setExpiration] = useState<ExpirationOption>("24h");
  const [accessControl, setAccessControl] = useState<AccessControl>("anyone");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: activeProfile } = useQuery<{ profile: ProfileSummary }>({
    queryKey: ["/api/profiles/active"],
  });

  const hasCancerTrack = activeProfile?.profile?.hasCancerTrack ?? false;
  const isChildProfile = activeProfile?.profile?.profileType === "child";

  const exportStartTime = useRef<number | null>(null);

  const trackExportComplete = async (packetType: string) => {
    if (exportStartTime.current) {
      try {
        await apiRequest("POST", "/api/analytics/packet-export/complete", {
          userId: "current-user",
          profileId: activeProfile?.profile?.id,
          packetType,
          startTime: exportStartTime.current,
        });
      } catch (e) {
        console.log("[Analytics] Failed to track export completion");
      }
      exportStartTime.current = null;
    }
  };

  const createPacketMutation = useMutation({
    mutationFn: async (data: { config: PacketConfig; expiration: string; accessControl: string }) => {
      exportStartTime.current = Date.now();
      const response = await apiRequest("POST", "/api/packets/create", data);
      return response.json();
    },
    onSuccess: (data) => {
      trackExportComplete(config.type);
      setGeneratedLink(data.shareUrl || `https://tabulamedica.app/share/${data.id}`);
      toast({
        title: "Packet created",
        description: "Your share link is ready.",
      });
    },
    onError: () => {
      exportStartTime.current = null;
      toast({
        title: "Failed to create packet",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async () => {
      exportStartTime.current = Date.now();
      const response = await apiRequest("POST", "/api/packets/download", { config });
      return response.blob();
    },
    onSuccess: (blob) => {
      trackExportComplete(config.type);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${config.type}-packet.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Download started",
        description: "Your PDF is being downloaded.",
      });
    },
    onError: () => {
      toast({
        title: "Download failed",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePacketSelect = (type: PacketType) => {
    setConfig(prev => ({ ...prev, type }));
    setStep(2);
  };

  const handleCreateLink = () => {
    createPacketMutation.mutate({ config, expiration, accessControl });
  };

  const handleCopyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getPreview = (): PacketPreview => {
    const sections: string[] = [];
    let docCount = 0;

    if (config.type === "emergency") {
      if (config.includeDemographics) { sections.push("Patient Demographics"); docCount += 1; }
      if (config.includeAllergies) { sections.push("Allergies"); docCount += 1; }
      if (config.includeMedications) { sections.push("Current Medications"); docCount += 1; }
      if (config.includeConditions) { sections.push("Key Diagnoses"); docCount += 1; }
      if (config.includeEmergencyContact) { sections.push("Emergency Contact"); docCount += 1; }
      if (config.includeCaregiverContact) { sections.push("Caregiver Contact"); docCount += 1; }
      return { sections, documentCount: docCount, estimatedPages: 1 };
    }

    if (config.type === "cancer" && hasCancerTrack) {
      if (config.includeCancerBasics) { sections.push("Cancer Basics"); docCount += 1; }
      if (config.includeTreatmentTimeline) { sections.push("Treatment Timeline"); docCount += 2; }
      if (config.includeMedications) { sections.push("Current Medications"); docCount += 1; }
      if (config.includeImagingReports) { sections.push("Recent Imaging/Labs"); docCount += 2; }
      if (config.includeLabs) { sections.push("Lab Results"); docCount += 2; }
      if (config.includeFollowUpSchedule) { sections.push("Follow-up Schedule"); docCount += 1; }
      if (config.includeSideEffectsJournal) { sections.push("Side Effects Summary"); docCount += 1; }
      return { sections, documentCount: docCount, estimatedPages: Math.ceil(docCount * 0.8) };
    }

    if (config.includeDemographics) { sections.push("Patient Demographics"); docCount += 1; }
    if (config.includeMedications) { sections.push("Medications"); docCount += 3; }
    if (config.includeAllergies) { sections.push("Allergies"); docCount += 1; }
    if (config.includeConditions) { sections.push("Conditions"); docCount += 2; }
    if (config.includeVisitSummaries) { sections.push("Visit Summaries"); docCount += 3; }
    if (config.includeImagingReports) { sections.push("Imaging Reports"); docCount += 2; }
    if (config.includeLabs) { sections.push("Lab Results"); docCount += 4; }
    if (config.includeEmergencyContact) { sections.push("Emergency Contact"); docCount += 1; }
    if (config.includeCaregiverContact) { sections.push("Caregiver Contact"); docCount += 1; }

    return {
      sections,
      documentCount: docCount,
      estimatedPages: Math.ceil(docCount * 0.5),
    };
  };

  const preview = getPreview();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-4 gap-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              className="min-h-[44px] min-w-[44px]"
              asChild
              data-testid="button-back"
            >
              <Link href="/profile-dashboard">
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                <span className="sr-only">Back</span>
              </Link>
            </Button>
            <span className="font-semibold">Export Packet</span>
          </div>
          <Badge variant="outline" className="text-xs">
            Step {step} of 3
          </Badge>
        </div>
        <Progress value={(step / 3) * 100} className="h-1" />
      </header>

      <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground bg-muted/50 border-b">
        <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Educational only. NOT medical advice. Consult your healthcare provider.</span>
      </div>

      <main className="max-w-2xl mx-auto p-4 pb-24">
        {step === 1 && (
          <Step1PacketType 
            onSelect={handlePacketSelect} 
            hasCancerTrack={hasCancerTrack}
            isChildProfile={isChildProfile}
          />
        )}

        {step === 2 && (
          <Step2Customize 
            config={config}
            setConfig={setConfig}
            hasCancerTrack={hasCancerTrack}
            onBack={() => setStep(1)}
            onPreview={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <Step3Preview
            config={config}
            preview={preview}
            expiration={expiration}
            setExpiration={setExpiration}
            accessControl={accessControl}
            setAccessControl={setAccessControl}
            generatedLink={generatedLink}
            copied={copied}
            onCopyLink={handleCopyLink}
            onCreateLink={handleCreateLink}
            onDownload={() => downloadMutation.mutate()}
            onBack={() => setStep(2)}
            isCreating={createPacketMutation.isPending}
            isDownloading={downloadMutation.isPending}
          />
        )}
      </main>
    </div>
  );
}

function Step1PacketType({ 
  onSelect, 
  hasCancerTrack, 
  isChildProfile 
}: { 
  onSelect: (type: PacketType) => void;
  hasCancerTrack: boolean;
  isChildProfile: boolean;
}) {
  const filteredPackets = packetTypes.filter(p => {
    if (p.condition === "cancer" && !hasCancerTrack) return false;
    if (p.condition === "child" && !isChildProfile) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">Export Packet</h1>
        <p className="text-muted-foreground mt-1">Choose what you want to share.</p>
      </div>

      <div className="grid gap-3">
        {filteredPackets.map((packet) => {
          const Icon = packet.icon;
          return (
            <button
              key={packet.type}
              onClick={() => onSelect(packet.type)}
              className="flex items-center gap-4 p-4 rounded-lg border text-left min-h-[72px] hover-elevate active-elevate-2 transition-colors"
              data-testid={`packet-${packet.type}`}
            >
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{packet.label}</p>
                <p className="text-sm text-muted-foreground">{packet.description}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Step2Customize({
  config,
  setConfig,
  hasCancerTrack,
  onBack,
  onPreview,
}: {
  config: PacketConfig;
  setConfig: React.Dispatch<React.SetStateAction<PacketConfig>>;
  hasCancerTrack: boolean;
  onBack: () => void;
  onPreview: () => void;
}) {
  const emergencyToggles: { key: keyof PacketConfig; label: string; icon: typeof Pill }[] = [
    { key: "includeDemographics", label: "Patient demographics", icon: User },
    { key: "includeAllergies", label: "Allergies", icon: ShieldAlert },
    { key: "includeMedications", label: "Current medications", icon: Pill },
    { key: "includeConditions", label: "Key diagnoses", icon: Activity },
    { key: "includeEmergencyContact", label: "Emergency contact", icon: Phone },
    { key: "includeCaregiverContact", label: "Caregiver contact", icon: UserCheck },
  ];

  const cancerToggles: { key: keyof PacketConfig; label: string; icon: typeof Pill; optional?: boolean }[] = [
    { key: "includeCancerBasics", label: "Cancer basics", icon: Ribbon },
    { key: "includeTreatmentTimeline", label: "Treatment timeline", icon: ClipboardList },
    { key: "includeMedications", label: "Current medications", icon: Pill },
    { key: "includeImagingReports", label: "Recent imaging/labs", icon: ImageIcon, optional: true },
    { key: "includeLabs", label: "Lab results", icon: TestTube2, optional: true },
    { key: "includeFollowUpSchedule", label: "Follow-up schedule", icon: CalendarDays },
    { key: "includeSideEffectsJournal", label: "Side effects summary", icon: FileWarning, optional: true },
  ];

  const generalToggles: { key: keyof PacketConfig; label: string; icon: typeof Pill }[] = [
    { key: "includeDemographics", label: "Patient demographics", icon: User },
    { key: "includeMedications", label: "Medications", icon: Pill },
    { key: "includeAllergies", label: "Allergies", icon: ShieldAlert },
    { key: "includeConditions", label: "Conditions", icon: Activity },
    { key: "includeVisitSummaries", label: "Visit summaries", icon: Calendar },
    { key: "includeImagingReports", label: "Imaging reports", icon: ImageIcon },
    { key: "includeLabs", label: "Lab results", icon: TestTube2 },
    { key: "includeEmergencyContact", label: "Emergency contact", icon: Phone },
    { key: "includeCaregiverContact", label: "Caregiver contact", icon: UserCheck },
  ];

  const visibleToggles = config.type === "emergency" 
    ? emergencyToggles 
    : config.type === "cancer" && hasCancerTrack 
      ? cancerToggles 
      : generalToggles;

  return (
    <div className="space-y-6">
      <div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onBack}
          className="mb-4 min-h-[44px] gap-2"
          data-testid="button-back-step"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Button>
        <h1 className="text-xl font-bold">Customize Packet</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Select what to include in your {config.type.replace("_", " ")} packet.
        </p>
        {config.type === "emergency" && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            Emergency packets are limited to 1 page for quick reference.
          </p>
        )}
        {config.type === "cancer" && (
          <p className="text-xs text-muted-foreground mt-2">
            Cancer packets can span multiple pages for comprehensive treatment history.
          </p>
        )}
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          {visibleToggles.map((toggle) => {
            const Icon = toggle.icon;
            const checked = config[toggle.key] as boolean;
            const isOptional = "optional" in toggle && (toggle as { optional?: boolean }).optional;
            return (
              <div 
                key={toggle.key} 
                className="flex items-center justify-between gap-3 py-2 min-h-[44px]"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  <Label htmlFor={toggle.key} className="cursor-pointer flex items-center gap-2">
                    {toggle.label}
                    {isOptional && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">Optional</Badge>
                    )}
                  </Label>
                </div>
                <div className="min-h-[44px] min-w-[44px] flex items-center justify-end">
                  <Switch
                    id={toggle.key}
                    checked={checked}
                    onCheckedChange={(value) => 
                      setConfig(prev => ({ ...prev, [toggle.key]: value }))
                    }
                    data-testid={`toggle-${toggle.key}`}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Label htmlFor="packet-export-time-range">Time Range</Label>
        <Select 
          value={config.timeRange} 
          onValueChange={(value: TimeRange) => setConfig(prev => ({ ...prev, timeRange: value }))}
        >
          <SelectTrigger id="packet-export-time-range" className="min-h-[44px]" data-testid="select-time-range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {timeRangeOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button 
        onClick={onPreview} 
        className="w-full min-h-[44px]"
        data-testid="button-preview-packet"
      >
        <Eye className="h-4 w-4 mr-2" aria-hidden="true" />
        Preview Packet
      </Button>
    </div>
  );
}

function Step3Preview({
  config,
  preview,
  expiration,
  setExpiration,
  accessControl,
  setAccessControl,
  generatedLink,
  copied,
  onCopyLink,
  onCreateLink,
  onDownload,
  onBack,
  isCreating,
  isDownloading,
}: {
  config: PacketConfig;
  preview: PacketPreview;
  expiration: ExpirationOption;
  setExpiration: (v: ExpirationOption) => void;
  accessControl: AccessControl;
  setAccessControl: (v: AccessControl) => void;
  generatedLink: string | null;
  copied: boolean;
  onCopyLink: () => void;
  onCreateLink: () => void;
  onDownload: () => void;
  onBack: () => void;
  isCreating: boolean;
  isDownloading: boolean;
}) {
  const packetInfo = packetTypes.find(p => p.type === config.type);
  const Icon = packetInfo?.icon || FileText;

  return (
    <div className="space-y-6">
      <div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onBack}
          className="mb-4 min-h-[44px] gap-2"
          data-testid="button-back-preview"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Button>
        <h1 className="text-xl font-bold">Preview & Share</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Review your packet before sharing.
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">{packetInfo?.label}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {preview.documentCount} documents • ~{preview.estimatedPages} pages
              </p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t">
            <p className="text-sm font-medium mb-2">Included Sections:</p>
            <div className="flex flex-wrap gap-2">
              {preview.sections.map((section) => (
                <Badge key={section} variant="secondary" className="text-xs">
                  {section}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="font-semibold">Share Options</h2>

        {!generatedLink ? (
          <>
            <div className="space-y-2">
              <FieldCaption>Link Expiration</FieldCaption>
              <RadioGroup 
                value={expiration} 
                onValueChange={(v) => setExpiration(v as ExpirationOption)}
                className="flex gap-2"
              >
                {expirationOptions.map(opt => (
                  <div key={opt.value} className="flex items-center">
                    <RadioGroupItem 
                      value={opt.value} 
                      id={`exp-${opt.value}`}
                      className="sr-only"
                    />
                    <Label
                      htmlFor={`exp-${opt.value}`}
                      className={`px-4 py-2 rounded-md border cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors ${
                        expiration === opt.value 
                          ? "border-primary bg-primary/10 text-primary" 
                          : "border-border hover:border-primary/50"
                      }`}
                      data-testid={`expiration-${opt.value}`}
                    >
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <FieldCaption>Access Control</FieldCaption>
              <RadioGroup 
                value={accessControl} 
                onValueChange={(v) => setAccessControl(v as AccessControl)}
                className="space-y-2"
              >
                <div 
                  className="flex items-center gap-3 p-4 rounded-md border cursor-pointer hover-elevate min-h-[56px]"
                  data-testid="access-anyone-option"
                >
                  <RadioGroupItem value="anyone" id="access-anyone" />
                  <Label htmlFor="access-anyone" className="flex-1 cursor-pointer">
                    <span className="font-medium">Anyone with link</span>
                    <p className="text-xs text-muted-foreground">Quick access, less secure</p>
                  </Label>
                </div>
                <div 
                  className="flex items-center gap-3 p-4 rounded-md border cursor-pointer hover-elevate min-h-[56px]"
                  data-testid="access-pin-option"
                >
                  <RadioGroupItem value="pin_required" id="access-pin" />
                  <Label htmlFor="access-pin" className="flex-1 cursor-pointer">
                    <span className="font-medium flex items-center gap-2">
                      <Lock className="h-4 w-4" aria-hidden="true" />
                      PIN required
                    </span>
                    <p className="text-xs text-muted-foreground">More secure, share PIN separately</p>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Button 
              onClick={onCreateLink}
              disabled={isCreating}
              className="w-full min-h-[44px]"
              data-testid="button-create-share-link"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                  Creating...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" aria-hidden="true" />
                  Create Share Link
                </>
              )}
            </Button>
          </>
        ) : (
          <Card className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-3">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                <span className="font-medium">Share Link Created</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm bg-background p-2 rounded border truncate">
                  {generatedLink}
                </code>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={onCopyLink}
                  className="min-h-[44px] min-w-[44px] shrink-0"
                  data-testid="button-copy-link"
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span className="sr-only">Copy link</span>
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" aria-hidden="true" />
                <span>Expires in {expirationOptions.find(o => o.value === expiration)?.label}</span>
                {accessControl === "pin_required" && (
                  <>
                    <span className="mx-1">•</span>
                    <Lock className="h-3 w-3" aria-hidden="true" />
                    <span>PIN required</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <Button 
          variant="outline"
          onClick={onDownload}
          disabled={isDownloading}
          className="w-full min-h-[44px]"
          data-testid="button-download-pdf"
        >
          {isDownloading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
              Preparing PDF...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" aria-hidden="true" />
              Download PDF
            </>
          )}
        </Button>
      </div>

      <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-packet-export-disclaimer" />
    </div>
  );
}
