import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  Calendar,
  ChevronRight,
  Download,
  FileText,
  Heart,
  Loader2,
  Package,
  Pill,
  Printer,
  Shield,
  Stethoscope,
  User,
  Users,
  Phone,
  Activity,
  AlertCircle,
  Clock,
  Clipboard,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  Eye,
  BookOpen,
  Link2,
  Copy,
  Check,
  Share2,
  QrCode,
  Trash2,
} from "lucide-react";
import type {
  CarePacketType,
  CarePacketData,
  CarePacketSection,
} from "@shared/schema";
import {
  carePacketLabels,
  carePacketDescriptions,
  carePacketSectionLabels,
} from "@shared/schema";

interface PacketInfo {
  type: CarePacketType;
  label: string;
  description: string;
  sections: CarePacketSection[];
  sectionCount: number;
}

const packetIcons: Record<CarePacketType, typeof FileText> = {
  new_oncologist: Stethoscope,
  er_visit: AlertCircle,
  primary_care: Heart,
  survivorship: Activity,
  specialist: Users,
  insurance: Clipboard,
};

const packetColors: Record<CarePacketType, string> = {
  new_oncologist: "bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30",
  er_visit: "bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30",
  primary_care: "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30",
  survivorship: "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30",
  specialist: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30",
  insurance: "bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/30",
};

interface ShareLinkData {
  shareId: string;
  secureLink: string;
  accessCode: string;
  expiresAt: string;
  packetType: string;
}

interface ActiveShare {
  shareId: string;
  packetType: CarePacketType;
  expiresAt: string;
  accessCount: number;
  createdAt: string;
  secureLink: string;
}

const EXPIRATION_OPTIONS = [
  { value: "1h", label: "1 hour" },
  { value: "24h", label: "24 hours" },
  { value: "72h", label: "3 days" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

function formatTimeRemaining(expiresAt: string): string {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = expiry.getTime() - now.getTime();
  
  if (diff <= 0) return "Expired";
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h remaining`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }
  return `${minutes}m remaining`;
}

export default function CarePackets() {
  const { toast } = useToast();
  const [selectedPacket, setSelectedPacket] = useState<CarePacketType | null>(null);
  const [showPacketView, setShowPacketView] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showActiveShares, setShowActiveShares] = useState(false);
  const [expiration, setExpiration] = useState("24h");
  const [generatedLink, setGeneratedLink] = useState<ShareLinkData | null>(null);
  const [copied, setCopied] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: packets, isLoading } = useQuery<PacketInfo[]>({
    queryKey: ["/api/care-packets"],
  });

  const { data: packetData, isLoading: loadingPacket } = useQuery<CarePacketData>({
    queryKey: ["/api/care-packets", selectedPacket],
    enabled: !!selectedPacket && showPacketView,
  });

  const { data: activeShares, refetch: refetchShares } = useQuery<ActiveShare[]>({
    queryKey: ["/api/care-packets/shares"],
    enabled: showActiveShares,
  });

  const createShareMutation = useMutation({
    mutationFn: async ({ packetType, expiration }: { packetType: CarePacketType; expiration: string }) => {
      const res = await apiRequest("POST", "/api/care-packets/share", {
        packetType,
        expiration,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedLink(data);
      toast({
        title: "Share link created",
        description: "Your secure link is ready to share.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to create link",
        description: "Could not generate share link. Please try again.",
        variant: "destructive",
      });
    },
  });

  const revokeShareMutation = useMutation({
    mutationFn: async (shareId: string) => {
      await apiRequest("DELETE", `/api/care-packets/shares/${shareId}`);
    },
    onSuccess: () => {
      refetchShares();
      toast({
        title: "Link revoked",
        description: "The share link has been deactivated.",
      });
    },
  });

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Link copied",
        description: "Share link copied to clipboard.",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Could not copy link. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCreateShare = () => {
    if (selectedPacket) {
      createShareMutation.mutate({ packetType: selectedPacket, expiration });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-6 px-4 space-y-6" id="main-content">
      <Alert className="bg-amber-500/10 border-amber-500/30" data-testid="alert-disclaimer">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <strong>NOT medical advice.</strong> Care Packets are information-only records for sharing with healthcare providers.
          This is patient-reported data and not a clinical assessment.
        </AlertDescription>
      </Alert>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            Care Packets
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            One-tap export packets for different care scenarios
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {packets?.map((packet) => {
          const Icon = packetIcons[packet.type];
          return (
            <Card
              key={packet.type}
              className="hover-elevate cursor-pointer transition-all"
              onClick={() => {
                setSelectedPacket(packet.type);
                setShowPacketView(true);
              }}
              data-testid={`packet-${packet.type}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className={`p-2 rounded-lg ${packetColors[packet.type]}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {packet.sectionCount} sections
                  </Badge>
                </div>
                <CardTitle className="text-lg mt-3">{packet.label}</CardTitle>
                <CardDescription>{packet.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {packet.sections.slice(0, 4).map((section) => (
                    <Badge key={section} variant="secondary" className="text-xs">
                      {carePacketSectionLabels[section]}
                    </Badge>
                  ))}
                  {packet.sections.length > 4 && (
                    <Badge variant="secondary" className="text-xs">
                      +{packet.sections.length - 4} more
                    </Badge>
                  )}
                </div>
                <Button className="w-full mt-4" data-testid={`button-generate-${packet.type}`}>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Packet
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showPacketView} onOpenChange={setShowPacketView}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="print:hidden">
            <DialogTitle className="flex items-center gap-2">
              {selectedPacket && (
                <>
                  {(() => {
                    const Icon = packetIcons[selectedPacket];
                    return <Icon className="h-5 w-5" />;
                  })()}
                  {carePacketLabels[selectedPacket]}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Generated {new Date().toLocaleDateString()} - Review and print or save
            </DialogDescription>
          </DialogHeader>

          {loadingPacket ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : packetData ? (
            <div ref={printRef} className="space-y-6 print:space-y-4">
              <div className="print:block hidden text-center border-b pb-4 mb-4">
                <h1 className="text-2xl font-bold">{carePacketLabels[packetData.packetType]}</h1>
                <p className="text-sm text-muted-foreground">
                  Generated: {new Date(packetData.generatedAt).toLocaleString()}
                </p>
              </div>

              <Card className="print:shadow-none print:border-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Patient Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Name</p>
                      <p className="font-medium">{packetData.patientInfo.name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Date of Birth</p>
                      <p className="font-medium">
                        {packetData.patientInfo.dateOfBirth
                          ? new Date(packetData.patientInfo.dateOfBirth).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">MRN</p>
                      <p className="font-medium">{packetData.patientInfo.mrn || "N/A"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {packetData.sections.diagnosis_timeline && (
                <Card className="print:shadow-none print:border-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Diagnosis & Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Cancer Type</p>
                        <p className="font-medium">{packetData.sections.diagnosis_timeline.cancerType}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Stage</p>
                        <p className="font-medium">{packetData.sections.diagnosis_timeline.stage || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Diagnosis Date</p>
                        <p className="font-medium">
                          {new Date(packetData.sections.diagnosis_timeline.diagnosisDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Treatment End</p>
                        <p className="font-medium">
                          {packetData.sections.diagnosis_timeline.treatmentEndDate
                            ? new Date(packetData.sections.diagnosis_timeline.treatmentEndDate).toLocaleDateString()
                            : "Ongoing"}
                        </p>
                      </div>
                    </div>
                    {packetData.sections.diagnosis_timeline.yearsSinceTreatment !== undefined && (
                      <p className="mt-2 text-sm">
                        <strong>{packetData.sections.diagnosis_timeline.yearsSinceTreatment} years</strong> since treatment completion
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {packetData.sections.treatment_history && packetData.sections.treatment_history.length > 0 && (
                <Card className="print:shadow-none print:border-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Stethoscope className="h-5 w-5" />
                      Treatment History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {packetData.sections.treatment_history.map((treatment, idx) => (
                        <div key={idx} className="border-l-2 border-primary/30 pl-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{treatment.type}</span>
                            {treatment.name && (
                              <span className="text-muted-foreground">- {treatment.name}</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {treatment.startDate && new Date(treatment.startDate).toLocaleDateString()}
                            {treatment.endDate && ` - ${new Date(treatment.endDate).toLocaleDateString()}`}
                          </p>
                          {treatment.notes && (
                            <p className="text-sm">{treatment.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {packetData.sections.current_medications && packetData.sections.current_medications.length > 0 && (
                <Card className="print:shadow-none print:border-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Pill className="h-5 w-5" />
                      Current Medications
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {packetData.sections.current_medications.map((med, idx) => (
                        <div key={idx} className="flex items-start justify-between gap-4 py-2 border-b last:border-0">
                          <div>
                            <p className="font-medium">{med.name} {med.dose}</p>
                            <p className="text-sm text-muted-foreground">
                              {med.frequency}{med.indication && ` - ${med.indication}`}
                            </p>
                          </div>
                          {med.prescriber && (
                            <p className="text-sm text-muted-foreground">{med.prescriber}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {packetData.sections.allergies && packetData.sections.allergies.length > 0 && (
                <Card className="print:shadow-none print:border-2 border-red-500/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2 text-red-600">
                      <AlertTriangle className="h-5 w-5" />
                      Allergies & Reactions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {packetData.sections.allergies.map((allergy, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
                          <div>
                            <p className="font-medium">{allergy.allergen}</p>
                            {allergy.reaction && (
                              <p className="text-sm text-muted-foreground">{allergy.reaction}</p>
                            )}
                          </div>
                          {allergy.severity && (
                            <Badge variant={allergy.severity === "Severe" ? "destructive" : "outline"}>
                              {allergy.severity}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {packetData.sections.recent_labs && packetData.sections.recent_labs.length > 0 && (
                <Card className="print:shadow-none print:border-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Recent Lab Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {packetData.sections.recent_labs.map((lab, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
                          <div>
                            <p className="font-medium">{lab.testName}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(lab.date).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{lab.value}</p>
                            {lab.status && (
                              <Badge variant={lab.status === "Normal" ? "outline" : "secondary"}>
                                {lab.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {packetData.sections.recent_imaging && packetData.sections.recent_imaging.length > 0 && (
                <Card className="print:shadow-none print:border-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Recent Imaging/Scans
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {packetData.sections.recent_imaging.map((scan, idx) => (
                        <div key={idx} className="py-2 border-b last:border-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium">{scan.type}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(scan.date).toLocaleDateString()}
                            </p>
                          </div>
                          {scan.findings && (
                            <p className="text-sm mt-1">{scan.findings}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {packetData.sections.side_effects_highlights && packetData.sections.side_effects_highlights.length > 0 && (
                <Card className="print:shadow-none print:border-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Side Effects Highlights
                    </CardTitle>
                    <CardDescription>
                      Symptoms reported while taking medications
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {packetData.sections.side_effects_highlights.map((effect, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
                          <div>
                            <p className="font-medium">{effect.symptom}</p>
                            {effect.medication && (
                              <p className="text-sm text-muted-foreground">
                                While taking: {effect.medication}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{effect.severity}</Badge>
                            <Badge variant="secondary">{effect.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {packetData.sections.side_effects_detailed && (
                <Card className="print:shadow-none print:border-2" data-testid="section-side-effects-detailed">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Patient-Reported Symptom Summary
                    </CardTitle>
                    <CardDescription>
                      Aggregated from patient journal entries - NOT a clinical assessment
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                      <div className="text-center p-2 border rounded-lg" data-testid="tile-total-entries">
                        <p className="text-2xl font-bold">{packetData.sections.side_effects_detailed.totalEntries}</p>
                        <p className="text-muted-foreground text-xs">Total Journal Entries</p>
                      </div>
                      <div className="text-center p-2 border rounded-lg" data-testid="tile-active-meds">
                        <p className="text-2xl font-bold">{packetData.sections.side_effects_detailed.activeMedications}</p>
                        <p className="text-muted-foreground text-xs">Active Medications</p>
                      </div>
                      <div 
                        className="text-center p-2 border rounded-lg flex flex-col items-center justify-center" 
                        data-testid="tile-overall-trend"
                        role="status"
                        aria-label={`Overall trend: ${packetData.sections.side_effects_detailed.severityTrends.overallTrend}`}
                      >
                        {packetData.sections.side_effects_detailed.severityTrends.overallTrend === "improving" && (
                          <TrendingDown className="h-6 w-6 text-green-600" aria-hidden="true" />
                        )}
                        {packetData.sections.side_effects_detailed.severityTrends.overallTrend === "worsening" && (
                          <TrendingUp className="h-6 w-6 text-red-600" aria-hidden="true" />
                        )}
                        {packetData.sections.side_effects_detailed.severityTrends.overallTrend === "stable" && (
                          <Minus className="h-6 w-6 text-amber-600" aria-hidden="true" />
                        )}
                        <p className="text-muted-foreground text-xs capitalize">
                          {packetData.sections.side_effects_detailed.severityTrends.overallTrend}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="font-medium text-sm">Top 3 Reported Symptoms:</p>
                      {packetData.sections.side_effects_detailed.topSymptoms.map((symptom, idx) => (
                        <div key={idx} className="border rounded-lg p-3" data-testid={`symptom-row-${idx}`}>
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="font-medium" data-testid={`symptom-name-${idx}`}>{symptom.symptom}</span>
                              <Badge variant="outline" className="text-xs" data-testid={`symptom-occurrences-${idx}`}>
                                {symptom.occurrences} entries
                              </Badge>
                            </div>
                            <div 
                              className="flex items-center gap-1" 
                              data-testid={`symptom-trend-${idx}`}
                              aria-label={`Symptom trend: ${symptom.trend}`}
                            >
                              {symptom.trend === "improving" && <TrendingDown className="h-4 w-4 text-green-600" aria-hidden="true" />}
                              {symptom.trend === "worsening" && <TrendingUp className="h-4 w-4 text-red-600" aria-hidden="true" />}
                              {symptom.trend === "stable" && <Minus className="h-4 w-4 text-amber-600" aria-hidden="true" />}
                              <span className="text-xs text-muted-foreground capitalize">{symptom.trend}</span>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1" data-testid={`symptom-medication-${idx}`}>
                            While taking: {symptom.medication}
                          </p>
                          <p className="text-sm mt-1">
                            <span className="text-muted-foreground">Avg Severity:</span>{" "}
                            <Badge variant={symptom.avgSeverity <= 2 ? "outline" : symptom.avgSeverity <= 4 ? "secondary" : "destructive"} data-testid={`symptom-severity-${idx}`}>
                              {symptom.avgSeverity.toFixed(1)}/5
                            </Badge>
                          </p>
                          {symptom.notes && (
                            <p className="text-sm text-muted-foreground mt-1" data-testid={`symptom-notes-${idx}`}>{symptom.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 p-3 bg-muted/50 rounded-lg" data-testid="severity-distribution">
                      <p className="font-medium text-sm mb-2">Severity Distribution (Last 90 Days):</p>
                      <div className="flex gap-4 text-sm">
                        <span className="flex items-center gap-1" data-testid="severity-mild">
                          <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                          Mild: {packetData.sections.side_effects_detailed.severityTrends.last90Days.mild}
                        </span>
                        <span className="flex items-center gap-1" data-testid="severity-moderate">
                          <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                          Moderate: {packetData.sections.side_effects_detailed.severityTrends.last90Days.moderate}
                        </span>
                        <span className="flex items-center gap-1" data-testid="severity-severe">
                          <span className="w-3 h-3 rounded-full bg-red-500"></span>
                          Severe: {packetData.sections.side_effects_detailed.severityTrends.last90Days.severe}
                        </span>
                      </div>
                    </div>

                    {packetData.sections.side_effects_detailed.summary && (
                      <p className="text-sm text-muted-foreground italic mt-2" data-testid="side-effects-summary">
                        {packetData.sections.side_effects_detailed.summary}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {packetData.sections.late_effects_watchlist && packetData.sections.late_effects_watchlist.length > 0 && (
                <Card className="print:shadow-none print:border-2 border-amber-500/30" data-testid="section-late-effects-watchlist">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <Eye className="h-5 w-5" />
                      Late Effects Watchlist
                    </CardTitle>
                    <CardDescription>
                      Conditions being monitored based on treatment history - for informational purposes only
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {packetData.sections.late_effects_watchlist.map((effect, idx) => (
                        <div key={idx} className="border rounded-lg p-3" data-testid={`late-effect-row-${idx}`}>
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="font-medium" data-testid={`late-effect-name-${idx}`}>{effect.effectType}</span>
                              <Badge 
                                variant={effect.status === "detected" ? "secondary" : "outline"}
                                className="text-xs capitalize"
                                data-testid={`late-effect-status-${idx}`}
                              >
                                {effect.status}
                              </Badge>
                            </div>
                            <Badge 
                              variant={
                                effect.riskLevel === "low" ? "outline" : 
                                effect.riskLevel === "moderate" ? "secondary" : 
                                "destructive"
                              }
                              className="text-xs capitalize"
                              data-testid={`late-effect-risk-${idx}`}
                            >
                              {effect.riskLevel} risk
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1" data-testid={`late-effect-treatments-${idx}`}>
                            Related to: {effect.relatedTreatments.join(", ")}
                          </p>
                          <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-muted-foreground">
                            <div data-testid={`late-effect-frequency-${idx}`}>
                              <span className="font-medium">Monitoring:</span> {effect.monitoringFrequency}
                            </div>
                            {effect.lastScreening && (
                              <div data-testid={`late-effect-last-${idx}`}>
                                <span className="font-medium">Last:</span> {new Date(effect.lastScreening).toLocaleDateString()}
                              </div>
                            )}
                            {effect.nextScreening && (
                              <div data-testid={`late-effect-next-${idx}`}>
                                <span className="font-medium">Next:</span> {new Date(effect.nextScreening).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                          {effect.notes && (
                            <p className="text-sm mt-2 border-t pt-2" data-testid={`late-effect-notes-${idx}`}>{effect.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {packetData.sections.treatment_history_reference && (
                <Card className="print:shadow-none print:border-2 border-purple-500/30" data-testid="section-treatment-history-reference">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2 text-purple-700 dark:text-purple-400">
                      <BookOpen className="h-5 w-5" />
                      Full Treatment History Reference
                    </CardTitle>
                    <CardDescription>
                      Access complete treatment documentation for comprehensive review
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="font-medium" data-testid="treatment-history-summary">{packetData.sections.treatment_history_reference.summary}</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {packetData.sections.treatment_history_reference.categories.map((cat, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 border rounded-lg text-sm" data-testid={`treatment-category-${idx}`}>
                          <span className="text-muted-foreground">{cat.type}</span>
                          <Badge variant="secondary">{cat.count}</Badge>
                        </div>
                      ))}
                    </div>

                    <div className="p-3 bg-purple-500/10 rounded-lg" data-testid="treatment-totals">
                      <p className="font-medium text-sm flex items-center gap-2" data-testid="text-total-documents">
                        <FileText className="h-4 w-4" />
                        Total Documents: {packetData.sections.treatment_history_reference.totalDocuments}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1" data-testid="text-last-updated">
                        Last Updated: {new Date(packetData.sections.treatment_history_reference.lastUpdated).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="p-3 border rounded-lg" data-testid="access-instructions">
                      <p className="text-sm font-medium mb-2">How to Access Full Records:</p>
                      <p className="text-sm text-muted-foreground" data-testid="text-access-instructions">
                        {packetData.sections.treatment_history_reference.accessInstructions}
                      </p>
                      <Button 
                        variant="outline" 
                        className="mt-3 print:hidden" 
                        size="sm"
                        onClick={() => window.open(packetData.sections.treatment_history_reference?.portalLink, '_blank')}
                        data-testid="button-view-full-history"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Full Treatment History
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {packetData.sections.follow_up_schedule && packetData.sections.follow_up_schedule.length > 0 && (
                <Card className="print:shadow-none print:border-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Follow-up Schedule
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {packetData.sections.follow_up_schedule.map((fu, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
                          <div>
                            <p className="font-medium">{fu.title}</p>
                            <p className="text-sm text-muted-foreground">{fu.category} - {fu.frequency}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">Next: {new Date(fu.nextDue).toLocaleDateString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {packetData.sections.care_team && packetData.sections.care_team.length > 0 && (
                <Card className="print:shadow-none print:border-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Care Team
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {packetData.sections.care_team.map((member, idx) => (
                        <div key={idx} className="p-3 border rounded-lg">
                          <p className="font-medium">{member.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {member.role}{member.specialty && ` - ${member.specialty}`}
                          </p>
                          {member.phone && (
                            <p className="text-sm flex items-center gap-1 mt-1">
                              <Phone className="h-3 w-3" />
                              {member.phone}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {packetData.sections.emergency_contacts && packetData.sections.emergency_contacts.length > 0 && (
                <Card className="print:shadow-none print:border-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Phone className="h-5 w-5" />
                      Emergency Contacts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {packetData.sections.emergency_contacts.map((contact, idx) => (
                        <div key={idx} className="p-3 border rounded-lg">
                          <p className="font-medium">{contact.name}</p>
                          <p className="text-sm text-muted-foreground">{contact.relationship}</p>
                          <p className="text-sm flex items-center gap-1 mt-1">
                            <Phone className="h-3 w-3" />
                            {contact.phone}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="print:hidden flex flex-col sm:flex-row justify-between gap-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setShowActiveShares(true)}
                  data-testid="button-manage-shares"
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Manage Active Links
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowPacketView(false)} data-testid="button-close-packet">
                    Close
                  </Button>
                  <Button variant="outline" onClick={handlePrint} data-testid="button-print-packet">
                    <Printer className="h-4 w-4 mr-2" />
                    Print / PDF
                  </Button>
                  <Button 
                    onClick={() => {
                      setGeneratedLink(null);
                      setShowShareDialog(true);
                    }}
                    data-testid="button-share-packet"
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Share Link
                  </Button>
                </div>
              </div>

              <div className="print:block hidden text-center text-sm text-muted-foreground mt-8 pt-4 border-t" data-testid="print-disclaimer">
                <p>This document is for informational purposes only. NOT medical advice.</p>
                <p>Information-only records. Not a clinical assessment.</p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Create Share Link
            </DialogTitle>
            <DialogDescription>
              Generate a secure, time-limited link to share this packet with a healthcare provider.
            </DialogDescription>
          </DialogHeader>

          {!generatedLink ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <FieldCaption>Packet Type</FieldCaption>
                <div className="p-3 bg-muted rounded-lg flex items-center gap-2">
                  {selectedPacket && (
                    <>
                      {(() => {
                        const Icon = packetIcons[selectedPacket];
                        return <Icon className="h-5 w-5" />;
                      })()}
                      <span className="font-medium">{carePacketLabels[selectedPacket]}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiration">Link Expiration</Label>
                <Select value={expiration} onValueChange={setExpiration}>
                  <SelectTrigger id="expiration" data-testid="select-expiration">
                    <SelectValue placeholder="Select expiration" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The link will automatically expire after this time.
                </p>
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  The recipient will need an access code to view the packet. You can revoke access at any time.
                </AlertDescription>
              </Alert>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowShareDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateShare}
                  disabled={createShareMutation.isPending}
                  data-testid="button-create-share"
                >
                  {createShareMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  Create Link
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert className="bg-green-500/10 border-green-500/30">
                <Check className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  Share link created successfully!
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="care-packets-secure-link">Secure Link</Label>
                <div className="flex gap-2">
                  <Input id="care-packets-secure-link" 
                    value={generatedLink.secureLink} 
                    readOnly 
                    className="font-mono text-sm"
                    data-testid="input-share-link"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => handleCopyLink(generatedLink.secureLink)}
                    data-testid="button-copy-link"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <FieldCaption>Access Code</FieldCaption>
                <div className="p-3 bg-muted rounded-lg font-mono text-lg tracking-widest text-center">
                  {generatedLink.accessCode}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Share this code with the recipient
                </p>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Expires:</span>
                <Badge variant="outline">
                  <Clock className="h-3 w-3 mr-1" />
                  {formatTimeRemaining(generatedLink.expiresAt)}
                </Badge>
              </div>

              <Separator />

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowShareDialog(false);
                    setGeneratedLink(null);
                  }}
                >
                  Done
                </Button>
                <Button onClick={() => handleCopyLink(generatedLink.secureLink)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showActiveShares} onOpenChange={setShowActiveShares}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Active Share Links
            </DialogTitle>
            <DialogDescription>
              Manage your active packet share links. You can revoke access at any time.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {!activeShares || activeShares.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Share2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No active share links</p>
                <p className="text-sm">Create a share link to share packets with providers.</p>
              </div>
            ) : (
              activeShares.map((share) => {
                const Icon = packetIcons[share.packetType];
                const isExpired = new Date(share.expiresAt) < new Date();
                
                return (
                  <Card key={share.shareId} className={isExpired ? "opacity-60" : ""}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${packetColors[share.packetType]}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{carePacketLabels[share.packetType]}</p>
                            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {isExpired ? (
                                <span className="text-red-500">Expired</span>
                              ) : (
                                formatTimeRemaining(share.expiresAt)
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                              <Eye className="h-3 w-3" />
                              <span>Viewed {share.accessCount} times</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyLink(share.secureLink)}
                            disabled={isExpired}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => revokeShareMutation.mutate(share.shareId)}
                            disabled={revokeShareMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActiveShares(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
