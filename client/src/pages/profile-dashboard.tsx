import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useSEO } from "@/hooks/use-seo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ProfileSwitcherSheet } from "@/components/profile-switcher";
import { Link } from "wouter";
import {
  Upload,
  Pill,
  Calendar,
  FileText,
  Package,
  Ribbon,
  BookOpen,
  Bell,
  Search,
  ChevronDown,
  Clock,
  MapPin,
  ArrowRight,
  AlertTriangle,
  X,
  Shield,
  Users,
  Stethoscope,
  Activity,
  Heart,
  FileCheck,
  Home,
  Share2,
  ClipboardList,
} from "lucide-react";
import { useAccessibility } from "@/components/accessibility-provider";
import type { Profile, ProfileTagAssociation, Appointment, Document } from "@shared/schema";
import { getInitials } from "@/components/shared";

interface ActiveProfileData {
  profile: Profile;
  tags: ProfileTagAssociation[];
  role: string;
}

interface DismissedAlert {
  profileId: string;
  alertId: string;
  dismissedAt: string;
}

const DISMISSED_ALERTS_KEY = "tabula_dismissed_alerts";

function formatRelativeTime(date: string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return d.toLocaleDateString();
}

function TopAppBar({ 
  profile, 
  onProfileChange 
}: { 
  profile: ActiveProfileData | null;
  onProfileChange?: () => void;
}) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4 gap-4">
        <div className="flex items-center gap-3">
          {profile?.profile ? (
            <ProfileSwitcherSheet
              currentProfileId={profile.profile.id}
              trigger={
                <Button 
                  variant="ghost" 
                  className="flex items-center gap-2 px-2 min-h-[44px] min-w-[44px]"
                  data-testid="button-profile-dropdown"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile.profile.profileImageUrl || undefined} />
                    <AvatarFallback className="text-xs">
                      {getInitials(profile.profile.firstName, profile.profile.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline font-medium truncate max-w-[150px]">
                    {profile.profile.firstName}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </Button>
              }
            />
          ) : (
            <Skeleton className="h-8 w-32" />
          )}
        </div>

        <span className="hidden md:block text-lg font-semibold">
          Tabula Medica
        </span>

        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon"
            className="min-h-[44px] min-w-[44px]"
            asChild
            data-testid="button-search"
          >
            <Link href="/search">
              <Search className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">Search</span>
            </Link>
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="min-h-[44px] min-w-[44px]"
            data-testid="button-notifications"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Notifications</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

function ProfileHeader({ profile }: { profile: ActiveProfileData | null }) {
  if (!profile?.profile) {
    return (
      <div className="flex items-center gap-4 p-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  const profileTypeLabels: Record<string, string> = {
    self: "Self",
    child: "Child",
    dependent_adult: "Dependent",
    elder: "Elder",
  };

  const lastUpdated = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <div className="flex items-center gap-4 p-4">
      <Avatar className="h-12 w-12">
        <AvatarImage src={profile.profile.profileImageUrl || undefined} />
        <AvatarFallback className="text-lg">
          {getInitials(profile.profile.firstName, profile.profile.lastName)}
        </AvatarFallback>
      </Avatar>
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold">
            {profile.profile.firstName} {profile.profile.lastName}
          </h1>
          <Badge variant="secondary" className="text-xs">
            {profileTypeLabels[profile.profile.profileType] || "Self"}
          </Badge>
          {profile.tags?.some(t => t.tag === "cancer_survivorship") && (
            <Badge variant="outline" className="text-xs">
              <Ribbon className="h-3 w-3 mr-1" aria-hidden="true" />
              Cancer Track
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Last updated: Today, {lastUpdated}
        </p>
      </div>
    </div>
  );
}

function QuickActionsSection({ hasCancerTrack }: { hasCancerTrack: boolean }) {
  const actions = [
    { 
      label: "Upload Document", 
      icon: Upload, 
      href: "/documents/upload",
      testId: "button-upload-document"
    },
    { 
      label: "Add Medication", 
      icon: Pill, 
      href: "/medications/add",
      testId: "button-add-medication"
    },
    { 
      label: "Add Timeline Event", 
      icon: Calendar, 
      href: "/timeline/add",
      testId: "button-add-timeline"
    },
    { 
      label: "Export Packet", 
      icon: Package, 
      href: "/packet-export",
      testId: "button-export-packet"
    },
  ];

  if (hasCancerTrack) {
    actions.push(
      { 
        label: "Cancer Track", 
        icon: Ribbon, 
        href: "/cancer-track",
        testId: "button-cancer-track"
      },
      { 
        label: "Side Effects Journal", 
        icon: BookOpen, 
        href: "/side-effects",
        testId: "button-side-effects"
      }
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2 min-h-[80px]"
              asChild
              data-testid={action.testId}
            >
              <Link href={action.href}>
                <action.icon className="h-6 w-6" aria-hidden="true" />
                <span className="text-sm text-center">{action.label}</span>
              </Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TodayNextSection() {
  const { data: appointments = [] } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
  });

  const { data: recentDocs = [] } = useQuery<Document[]>({
    queryKey: ["/api/documents", { limit: 1 }],
  });

  const { data: followUps = [] } = useQuery<{ id: string; title: string; dueDate: string }[]>({
    queryKey: ["/api/follow-ups"],
  });

  const { data: medicationChanges = [] } = useQuery<{ id: string; name: string; changedAt: string; changeType: string }[]>({
    queryKey: ["/api/medications/changes"],
  });

  const { data: packetExports = [] } = useQuery<{ id: string; name: string; exportedAt: string }[]>({
    queryKey: ["/api/exports/recent"],
  });

  const nextAppointment = appointments[0];
  const nextFollowUp = followUps[0];
  const lastMedicationChange = medicationChanges[0];
  const lastExport = packetExports[0];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Upcoming</CardTitle>
            <Button variant="ghost" size="sm" className="min-h-[44px]" asChild>
              <Link href="/appointments">
                View all
                <ArrowRight className="h-4 w-4 ml-1" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {nextAppointment ? (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{nextAppointment.title}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1 flex-wrap">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  <span>{new Date(nextAppointment.scheduledAt).toLocaleDateString()}</span>
                  {nextAppointment.facility && (
                    <>
                      <MapPin className="h-3 w-3 ml-2" aria-hidden="true" />
                      <span className="truncate">{nextAppointment.facility}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-2 text-center">
              No upcoming appointments
            </div>
          )}

          {nextFollowUp ? (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Bell className="h-5 w-5 text-orange-500" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{nextFollowUp.title}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  <span>Due: {new Date(nextFollowUp.dueDate).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-2 text-center">
              No follow-up reminders
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentDocs.length > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{recentDocs[0].title}</p>
                <p className="text-sm text-muted-foreground">
                  Document uploaded {formatRelativeTime(recentDocs[0].uploadedAt)}
                </p>
              </div>
            </div>
          )}

          {lastMedicationChange && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Pill className="h-5 w-5 text-blue-500" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{lastMedicationChange.name}</p>
                <p className="text-sm text-muted-foreground">
                  Medication {lastMedicationChange.changeType} {formatRelativeTime(lastMedicationChange.changedAt)}
                </p>
              </div>
            </div>
          )}

          {lastExport && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Package className="h-5 w-5 text-green-500" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{lastExport.name}</p>
                <p className="text-sm text-muted-foreground">
                  Packet exported {formatRelativeTime(lastExport.exportedAt)}
                </p>
              </div>
            </div>
          )}

          {recentDocs.length === 0 && !lastMedicationChange && !lastExport && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No recent activity
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function YourRecordsSection() {
  const tiles = [
    { label: "Medications", icon: Pill, href: "/medications", color: "bg-blue-500/10 text-blue-500" },
    { label: "Allergies", icon: AlertTriangle, href: "/allergies", color: "bg-red-500/10 text-red-500" },
    { label: "Conditions", icon: Heart, href: "/conditions", color: "bg-purple-500/10 text-purple-500" },
    { label: "Care Team", icon: Stethoscope, href: "/care-team", color: "bg-green-500/10 text-green-500" },
    { label: "Documents", icon: FileText, href: "/documents", color: "bg-orange-500/10 text-orange-500" },
    { label: "Timeline", icon: Activity, href: "/timeline", color: "bg-cyan-500/10 text-cyan-500" },
  ];

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold px-1">Your Records</h2>
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-3 pb-2">
          {tiles.map((tile) => (
            <Link key={tile.label} href={tile.href}>
              <Card className="w-[100px] hover-elevate cursor-pointer" data-testid={`tile-${tile.label.toLowerCase().replace(" ", "-")}`}>
                <CardContent className="p-4 flex flex-col items-center gap-2">
                  <div className={`p-3 rounded-lg ${tile.color}`}>
                    <tile.icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <span className="text-xs font-medium text-center">{tile.label}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

function AlertsSection({ 
  profileId,
  hasCancerTrack,
  medicationCount,
  allergyCount,
}: { 
  profileId: string;
  hasCancerTrack: boolean;
  medicationCount: number;
  allergyCount: number;
}) {
  const [dismissedAlerts, setDismissedAlerts] = useState<DismissedAlert[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(DISMISSED_ALERTS_KEY);
    if (stored) {
      try {
        setDismissedAlerts(JSON.parse(stored));
      } catch {
        setDismissedAlerts([]);
      }
    }
  }, []);

  const dismissAlert = (alertId: string) => {
    const newDismissed: DismissedAlert = {
      profileId,
      alertId,
      dismissedAt: new Date().toISOString(),
    };
    const updated = [...dismissedAlerts, newDismissed];
    setDismissedAlerts(updated);
    localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify(updated));
  };

  const isDismissed = (alertId: string) => {
    return dismissedAlerts.some(
      (d) => d.profileId === profileId && d.alertId === alertId
    );
  };

  const alerts: { id: string; message: string; type: "warning" | "info" }[] = [];

  if (medicationCount === 0 && !isDismissed("no_medications")) {
    alerts.push({ id: "no_medications", message: "No medications recorded", type: "info" });
  }
  if (allergyCount === 0 && !isDismissed("no_allergies")) {
    alerts.push({ id: "no_allergies", message: "No allergies recorded", type: "info" });
  }
  if (hasCancerTrack && !isDismissed("survivorship_schedule")) {
    alerts.push({ 
      id: "survivorship_schedule", 
      message: "Cancer Track enabled — survivorship schedule not set", 
      type: "warning" 
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold px-1">Alerts</h2>
      <div className="space-y-2">
        {alerts.map((alert) => (
          <Alert 
            key={alert.id} 
            variant={alert.type === "warning" ? "destructive" : "default"}
            className="pr-10 relative"
          >
            {alert.type === "warning" ? (
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Shield className="h-4 w-4" aria-hidden="true" />
            )}
            <AlertDescription>{alert.message}</AlertDescription>
            <button
              onClick={() => dismissAlert(alert.id)}
              className="absolute right-2 top-2 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover-elevate rounded"
              aria-label="Dismiss alert"
              data-testid={`dismiss-alert-${alert.id}`}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </Alert>
        ))}
      </div>
    </div>
  );
}

function NoCDSDisclaimer() {
  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200 dark:border-amber-800 px-4 py-2 mt-auto">
      <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200">
        <Shield className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
        <span>
          <strong>Educational Only:</strong> This app does NOT provide medical advice. 
          Consult your healthcare provider for medical decisions.
        </span>
      </div>
    </div>
  );
}

export default function ProfileDashboard() {
  useSEO({
    title: "Dashboard | Tabula Medica",
    description: "Your personal health dashboard - view records, appointments, and quick actions",
  });

  const { data: activeProfile, isLoading } = useQuery<ActiveProfileData>({
    queryKey: ["/api/profiles/active"],
  });

  const { data: medications = [] } = useQuery({
    queryKey: ["/api/medications"],
  });

  const { data: allergies = [] } = useQuery({
    queryKey: ["/api/allergies"],
  });

  const hasCancerTrack = activeProfile?.tags?.some(t => t.tag === "cancer_survivorship") || false;
  const profileId = activeProfile?.profile?.id || "";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopAppBar profile={activeProfile || null} />
      
      <main className="flex-1 pb-24">
        <div className="max-w-2xl mx-auto">
          <ProfileHeader profile={activeProfile || null} />
          
          <div className="space-y-6 px-4 pb-6">
            <QuickActionsSection hasCancerTrack={hasCancerTrack} />
            
            <TodayNextSection />
            
            <YourRecordsSection />
            
            {!isLoading && activeProfile && (
              <AlertsSection
                profileId={profileId}
                hasCancerTrack={hasCancerTrack}
                medicationCount={Array.isArray(medications) ? medications.length : 0}
                allergyCount={Array.isArray(allergies) ? allergies.length : 0}
              />
            )}
          </div>
        </div>
      </main>

      <BottomNavigationBar />

      <NoCDSDisclaimer />
    </div>
  );
}

function BottomNavigationBar() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  const navItems = [
    { label: "Home", icon: Home, href: "/profile-dashboard", testId: "nav-home" },
    { label: "Timeline", icon: Activity, href: "/timeline", testId: "nav-timeline" },
    { label: "Documents", icon: FileText, href: "/documents", testId: "nav-documents" },
    { label: "Follow-Ups", icon: ClipboardList, href: "/follow-up-drafts", testId: "nav-followups" },
    { label: "Share", icon: Share2, href: "/share-export", testId: "nav-share" },
  ];

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      role="navigation"
      aria-label="Main navigation"
      data-testid="bottom-navigation"
    >
      <div className="flex items-center justify-around h-16 max-w-2xl mx-auto px-2">
        {navItems.map((item) => {
          const isActive = currentPath === item.href;
          return (
            <Link key={item.label} href={item.href}>
              <button
                className={`flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[44px] px-3 py-2 rounded-lg hover-elevate active-elevate-2 transition-colors ${
                  isActive 
                    ? "text-primary bg-primary/10" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid={item.testId}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
              >
                <item.icon className="h-5 w-5" aria-hidden="true" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
