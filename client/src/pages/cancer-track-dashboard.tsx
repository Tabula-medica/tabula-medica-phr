import { useState } from "react";
import { useSEO } from "@/hooks/use-seo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import {
  Calendar,
  Ribbon,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  ChevronRight,
  TrendingUp,
  Pill,
  Stethoscope,
  Heart,
  Home,
  Download,
} from "lucide-react";
import { useViewMode } from "@/contexts/view-mode-context";
import { ViewModeBanner } from "@/components/view-mode-selector";

interface TreatmentEvent {
  id: string;
  date: string;
  type: "diagnosis" | "surgery" | "chemotherapy" | "radiation" | "immunotherapy" | "scan" | "followup" | "remission";
  title: string;
  description: string;
  provider?: string;
  notes?: string;
  sideEffects?: string[];
}

interface FollowUp {
  id: string;
  date: string;
  type: string;
  provider: string;
  status: "scheduled" | "completed" | "overdue";
  notes?: string;
}

interface SideEffect {
  id: string;
  name: string;
  severity: "mild" | "moderate" | "severe";
  firstReported: string;
  status: "active" | "resolved" | "managed";
  treatments?: string[];
}

const treatmentTimeline: TreatmentEvent[] = [
  {
    id: "1",
    date: "2020-03-15",
    type: "diagnosis",
    title: "Initial Diagnosis",
    description: "Stage II Breast Cancer diagnosed",
    provider: "Dr. Sarah Chen, Oncology",
    notes: "HER2-positive, hormone receptor positive",
  },
  {
    id: "2",
    date: "2020-04-02",
    type: "surgery",
    title: "Lumpectomy",
    description: "Breast-conserving surgery with sentinel node biopsy",
    provider: "Dr. Michael Torres, Surgical Oncology",
    notes: "Clear margins achieved",
  },
  {
    id: "3",
    date: "2020-05-15",
    type: "chemotherapy",
    title: "AC-T Chemotherapy Started",
    description: "Adriamycin + Cyclophosphamide followed by Taxol",
    provider: "Dr. Sarah Chen, Oncology",
    sideEffects: ["Fatigue", "Nausea", "Hair loss", "Neuropathy"],
  },
  {
    id: "4",
    date: "2020-09-20",
    type: "radiation",
    title: "Radiation Therapy",
    description: "33 sessions of whole breast radiation",
    provider: "Dr. Lisa Park, Radiation Oncology",
    sideEffects: ["Skin irritation", "Fatigue"],
  },
  {
    id: "5",
    date: "2021-01-10",
    type: "immunotherapy",
    title: "Herceptin Started",
    description: "Targeted therapy for HER2-positive cancer",
    provider: "Dr. Sarah Chen, Oncology",
  },
  {
    id: "6",
    date: "2022-01-15",
    type: "scan",
    title: "Annual Mammogram",
    description: "No evidence of recurrence",
    provider: "Imaging Center",
  },
  {
    id: "7",
    date: "2023-01-20",
    type: "scan",
    title: "Annual Mammogram",
    description: "No evidence of recurrence",
    provider: "Imaging Center",
  },
  {
    id: "8",
    date: "2024-03-15",
    type: "remission",
    title: "4 Year Milestone",
    description: "Continued remission - transitioning to annual monitoring",
    provider: "Dr. Sarah Chen, Oncology",
  },
];

const upcomingFollowUps: FollowUp[] = [
  {
    id: "1",
    date: "2025-03-15",
    type: "Annual Mammogram",
    provider: "Imaging Center",
    status: "scheduled",
  },
  {
    id: "2",
    date: "2025-04-01",
    type: "Oncology Follow-up",
    provider: "Dr. Sarah Chen",
    status: "scheduled",
  },
  {
    id: "3",
    date: "2025-06-15",
    type: "Blood Work",
    provider: "Lab Services",
    status: "scheduled",
  },
];

const activeSideEffects: SideEffect[] = [
  {
    id: "1",
    name: "Peripheral Neuropathy",
    severity: "mild",
    firstReported: "2020-07-15",
    status: "managed",
    treatments: ["Gabapentin", "Physical therapy"],
  },
  {
    id: "2",
    name: "Joint Pain",
    severity: "mild",
    firstReported: "2021-03-01",
    status: "managed",
    treatments: ["Exercise", "NSAIDs as needed"],
  },
];

const eventTypeConfig: Record<TreatmentEvent["type"], { icon: typeof Ribbon; color: string; label: string }> = {
  diagnosis: { icon: FileText, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30", label: "Diagnosis" },
  surgery: { icon: Stethoscope, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30", label: "Surgery" },
  chemotherapy: { icon: Pill, color: "bg-red-100 text-red-700 dark:bg-red-900/30", label: "Chemotherapy" },
  radiation: { icon: Activity, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30", label: "Radiation" },
  immunotherapy: { icon: Heart, color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30", label: "Immunotherapy" },
  scan: { icon: FileText, color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30", label: "Scan" },
  followup: { icon: Calendar, color: "bg-green-100 text-green-700 dark:bg-green-900/30", label: "Follow-up" },
  remission: { icon: CheckCircle, color: "bg-green-100 text-green-700 dark:bg-green-900/30", label: "Milestone" },
};

function TimelineEvent({ event }: { event: TreatmentEvent }) {
  const config = eventTypeConfig[event.type];
  const Icon = config.icon;

  return (
    <div className="flex gap-4" data-testid={`timeline-event-${event.id}`}>
      <div className="flex flex-col items-center">
        <div className={`p-2 rounded-full ${config.color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="w-0.5 flex-1 bg-muted mt-2" />
      </div>
      <div className="flex-1 pb-8">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs">{config.label}</Badge>
          <span className="text-sm text-muted-foreground">
            {new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>
        <h3 className="font-semibold">{event.title}</h3>
        <p className="text-sm text-muted-foreground">{event.description}</p>
        {event.provider && (
          <p className="text-sm text-muted-foreground mt-1">{event.provider}</p>
        )}
        {event.notes && (
          <p className="text-sm mt-2 p-2 bg-muted/50 rounded">{event.notes}</p>
        )}
        {event.sideEffects && event.sideEffects.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {event.sideEffects.map((effect, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">{effect}</Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CancerTrackDashboard() {
  useSEO({
    title: "Cancer Journey | Tabula Medica",
    description: "Long-term oncology timeline and follow-up tracking",
  });

  const [activeTab, setActiveTab] = useState("timeline");
  const yearsSinceDiagnosis = Math.floor(
    (Date.now() - new Date("2020-03-15").getTime()) / (1000 * 60 * 60 * 24 * 365)
  );

  return (
    <div className="min-h-screen bg-background">
      <ViewModeBanner />

      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Ribbon className="h-6 w-6 text-pink-500" />
              Cancer Journey Timeline
            </h1>
            <p className="text-muted-foreground">
              {yearsSinceDiagnosis} years since diagnosis
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/packet-export">
              <Button variant="outline" data-testid="button-export-packet">
                <Download className="h-4 w-4 mr-2" />
                Export Packet
              </Button>
            </Link>
            <Link href="/">
              <Button variant="ghost" data-testid="button-back-home">
                <Home className="h-4 w-4 mr-2" />
                Home
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{yearsSinceDiagnosis}</p>
                <p className="text-sm text-muted-foreground">Years Survivor</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold">{treatmentTimeline.length}</p>
                <p className="text-sm text-muted-foreground">Treatment Events</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">{upcomingFollowUps.length}</p>
                <p className="text-sm text-muted-foreground">Upcoming Follow-ups</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-amber-600">{activeSideEffects.length}</p>
                <p className="text-sm text-muted-foreground">Managed Side Effects</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="timeline" data-testid="tab-timeline">
              <Clock className="h-4 w-4 mr-2" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="followups" data-testid="tab-followups">
              <Calendar className="h-4 w-4 mr-2" />
              Follow-ups
            </TabsTrigger>
            <TabsTrigger value="sideeffects" data-testid="tab-sideeffects">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Side Effects
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Treatment History</CardTitle>
                <CardDescription>Complete timeline from diagnosis to present</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] pr-4">
                  {treatmentTimeline.map(event => (
                    <TimelineEvent key={event.id} event={event} />
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="followups" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Follow-ups</CardTitle>
                <CardDescription>Scheduled monitoring and appointments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {upcomingFollowUps.map(followup => (
                    <div key={followup.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`followup-${followup.id}`}>
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30">
                          <Calendar className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-medium">{followup.type}</h3>
                          <p className="text-sm text-muted-foreground">{followup.provider}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {new Date(followup.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                        <Badge variant={followup.status === "scheduled" ? "default" : followup.status === "overdue" ? "destructive" : "secondary"}>
                          {followup.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sideeffects" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Side Effects Tracking</CardTitle>
                <CardDescription>Long-term effects from treatment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activeSideEffects.map(effect => (
                    <div key={effect.id} className="p-4 border rounded-lg" data-testid={`sideeffect-${effect.id}`}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">{effect.name}</h3>
                        <div className="flex gap-2">
                          <Badge variant={effect.severity === "severe" ? "destructive" : effect.severity === "moderate" ? "secondary" : "outline"}>
                            {effect.severity}
                          </Badge>
                          <Badge variant={effect.status === "active" ? "destructive" : effect.status === "managed" ? "default" : "secondary"}>
                            {effect.status}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        First reported: {new Date(effect.firstReported).toLocaleDateString()}
                      </p>
                      {effect.treatments && effect.treatments.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {effect.treatments.map((treatment, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">{treatment}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
