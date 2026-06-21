import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  PopulationDashboardWrapper,
  PopulationSelector,
  QuickAccessPanel,
  PopulationBanner,
  usePopulation,
} from "@/components/population-dashboard-wrapper";
import { VoiceNavigationControl } from "@/components/voice-navigation-control";
import { useAccessibility } from "@/components/accessibility-provider";
import { Link } from "wouter";
import {
  Heart,
  Pill,
  Calendar,
  Users,
  Bell,
  Phone,
  FileText,
  Activity,
  Baby,
  Ribbon,
  Accessibility,
  Volume2,
  Eye,
  Type,
  MessageSquare,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Clock,
  Stethoscope,
  Shield,
  Zap,
  Settings,
  HelpCircle,
  Mic,
} from "lucide-react";
import { cn } from "@/lib/utils";

function GeriatricQuickView() {
  const { data: medications } = useQuery<any[]>({
    queryKey: ["/api/medications"],
  });

  const { data: appointments } = useQuery<any[]>({
    queryKey: ["/api/appointments/upcoming"],
  });

  return (
    <div className="space-y-6">
      <Card className="border-2 border-primary/20" data-testid="card-geriatric-medications">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl flex items-center gap-3">
            <Pill className="h-7 w-7 text-rose-500" />
            Today's Medications
          </CardTitle>
          <CardDescription className="text-lg">
            Take these medications as scheduled
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {medications?.slice(0, 4).map((med: any) => (
            <div
              key={med.id}
              className="flex items-center justify-between p-4 bg-muted rounded-lg"
            >
              <div className="space-y-1">
                <p className="text-xl font-semibold">{med.name}</p>
                <p className="text-lg text-muted-foreground">{med.dosage}</p>
              </div>
              <Button size="lg" data-testid={`button-take-${med.id}`}>
                <CheckCircle className="h-5 w-5 mr-2" />
                Mark Taken
              </Button>
            </div>
          )) || (
            <div className="text-center py-8 text-muted-foreground">
              <Pill className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg">No medications scheduled for today</p>
            </div>
          )}
          <Button variant="outline" className="w-full" asChild>
            <Link href="/medications">
              View All Medications
              <ChevronRight className="h-5 w-5 ml-2" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card data-testid="card-geriatric-appointments">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl flex items-center gap-3">
            <Calendar className="h-7 w-7 text-blue-500" />
            Upcoming Appointments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {appointments?.slice(0, 2).map((apt: any) => (
            <div
              key={apt.id}
              className="flex items-center justify-between p-4 bg-muted rounded-lg"
            >
              <div className="space-y-1">
                <p className="text-xl font-semibold">{apt.providerName}</p>
                <p className="text-lg text-muted-foreground">
                  {new Date(apt.scheduledAt).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <Badge className="text-base px-3 py-1">
                {apt.specialty || "Doctor"}
              </Badge>
            </div>
          )) || (
            <div className="text-center py-6 text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-lg">No upcoming appointments</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Button
          size="lg"
          variant="outline"
          className="flex-col gap-2"
          asChild
          data-testid="button-call-doctor"
        >
          <Link href="/messages">
            <Phone className="h-6 w-6 text-green-500" />
            Call My Doctor
          </Link>
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="flex-col gap-2"
          asChild
          data-testid="button-emergency-contacts"
        >
          <Link href="/caregivers">
            <Users className="h-6 w-6 text-amber-500" />
            Emergency Contacts
          </Link>
        </Button>
      </div>
    </div>
  );
}

function PediatricQuickView() {
  const { data: childProfile } = useQuery<any>({
    queryKey: ["/api/pediatric/profile"],
  });

  return (
    <div className="space-y-6">
      <Card data-testid="card-pediatric-overview">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Baby className="h-5 w-5 text-cyan-500" />
            Child Health Overview
          </CardTitle>
          <CardDescription>
            Track your child's growth and health milestones
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild data-testid="button-growth-chart">
              <Link href="/pediatric">
                <Activity className="h-6 w-6 text-cyan-500" />
                <span>Growth Chart</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild data-testid="button-immunizations">
              <Link href="/pediatric">
                <Shield className="h-6 w-6 text-green-500" />
                <span>Immunizations</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild data-testid="button-milestones">
              <Link href="/pediatric">
                <CheckCircle className="h-6 w-6 text-purple-500" />
                <span>Milestones</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild data-testid="button-pediatric-medications">
              <Link href="/medications">
                <Pill className="h-6 w-6 text-rose-500" />
                <span>Medications</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-pediatric-immunizations">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-500" />
            Immunization Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span>All vaccines up to date</span>
              </div>
              <Badge variant="secondary">Complete</Badge>
            </div>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/pediatric">
                View Full Immunization Record
                <ChevronRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-pediatric-appointments">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            Upcoming Wellness Visits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-3 bg-muted rounded-lg mb-3">
            <p className="font-medium">Annual Checkup</p>
            <p className="text-sm text-muted-foreground">
              Schedule next wellness visit
            </p>
          </div>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/timeline">
              Schedule Appointment
              <ChevronRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function OncologyQuickView() {
  return (
    <div className="space-y-6">
      <Alert className="border-purple-500/50 bg-purple-500/10">
        <Ribbon className="h-5 w-5 text-purple-500" />
        <AlertTitle>Oncology Care Dashboard</AlertTitle>
        <AlertDescription>
          Track your treatment journey, manage symptoms, and access your survivorship care plan.
          We're here to support you every step of the way.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="hover-elevate" data-testid="card-treatment-timeline">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-500" />
              Treatment Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              View your complete treatment history and upcoming sessions
            </p>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/cancer-track">
                View Timeline
                <ChevronRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-side-effects">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Side Effects Journal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Track and report symptoms to your care team
            </p>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/side-effects-journal">
                Log Symptoms
                <ChevronRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-survivorship">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="h-5 w-5 text-rose-500" />
              Survivorship Care
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Your personalized survivorship care plan and resources
            </p>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/survivorship">
                View Care Plan
                <ChevronRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-care-team">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-blue-500" />
              Care Team
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Connect with your oncology care team
            </p>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/messages">
                Contact Team
                <ChevronRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-support-resources">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-green-500" />
            Support Resources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button variant="outline" className="h-auto py-3 flex-col gap-1" asChild>
              <Link href="/support-resources">
                <MessageSquare className="h-5 w-5" />
                <span className="text-sm">Support Groups</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-1" asChild>
              <Link href="/learn">
                <FileText className="h-5 w-5" />
                <span className="text-sm">Education</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-1" asChild>
              <Link href="/care-packets">
                <Shield className="h-5 w-5" />
                <span className="text-sm">Care Packets</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AccessibilityQuickView() {
  const { settings, updateSetting } = useAccessibility();

  return (
    <div className="space-y-6">
      <Alert className="border-green-500/50 bg-green-500/10">
        <Accessibility className="h-5 w-5 text-green-500" />
        <AlertTitle>Accessibility Mode Active</AlertTitle>
        <AlertDescription>
          Enhanced accessibility features are enabled. Use voice commands or keyboard navigation
          to interact with the app. Say "help" for available voice commands.
        </AlertDescription>
      </Alert>

      <Card data-testid="card-voice-controls">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            Voice Navigation
          </CardTitle>
          <CardDescription>
            Control the app with your voice
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg">
            <div className="flex items-center gap-3">
              <Volume2 className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium">Voice Navigation</p>
                <p className="text-sm text-muted-foreground">
                  {settings.voiceNavigation ? "Enabled" : "Disabled"}
                </p>
              </div>
            </div>
            <Button
              variant={settings.voiceNavigation ? "default" : "outline"}
              onClick={() => updateSetting("voiceNavigation", !settings.voiceNavigation)}
              data-testid="button-toggle-voice"
            >
              {settings.voiceNavigation ? "Enabled" : "Enable"}
            </Button>
          </div>

          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Quick Voice Commands:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>"Go to medications" - View medications</li>
              <li>"Read my health summary" - Hear your summary</li>
              <li>"Help" - Get available commands</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-accessibility-settings">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Quick Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant={settings.largeText ? "default" : "outline"}
              className="h-auto py-4 flex-col gap-2"
              onClick={() => updateSetting("largeText", !settings.largeText)}
              data-testid="button-large-text"
            >
              <Type className="h-6 w-6" />
              <span>Large Text</span>
              <Badge variant="secondary" className="text-xs">
                {settings.largeText ? "On" : "Off"}
              </Badge>
            </Button>
            <Button
              variant={settings.highContrast ? "default" : "outline"}
              className="h-auto py-4 flex-col gap-2"
              onClick={() => updateSetting("highContrast", !settings.highContrast)}
              data-testid="button-high-contrast"
            >
              <Eye className="h-6 w-6" />
              <span>High Contrast</span>
              <Badge variant="secondary" className="text-xs">
                {settings.highContrast ? "On" : "Off"}
              </Badge>
            </Button>
            <Button
              variant={settings.screenReaderOptimized ? "default" : "outline"}
              className="h-auto py-4 flex-col gap-2"
              onClick={() => updateSetting("screenReaderOptimized", !settings.screenReaderOptimized)}
              data-testid="button-screen-reader"
            >
              <Volume2 className="h-6 w-6" />
              <span>Screen Reader</span>
              <Badge variant="secondary" className="text-xs">
                {settings.screenReaderOptimized ? "On" : "Off"}
              </Badge>
            </Button>
            <Button
              variant={settings.simplifiedView ? "default" : "outline"}
              className="h-auto py-4 flex-col gap-2"
              onClick={() => updateSetting("simplifiedView", !settings.simplifiedView)}
              data-testid="button-simplified"
            >
              <Zap className="h-6 w-6" />
              <span>Simple View</span>
              <Badge variant="secondary" className="text-xs">
                {settings.simplifiedView ? "On" : "Off"}
              </Badge>
            </Button>
          </div>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/accessibility">
              All Accessibility Settings
              <ChevronRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function CaregiverQuickView() {
  return (
    <div className="space-y-6">
      <Alert className="border-amber-500/50 bg-amber-500/10">
        <Users className="h-5 w-5 text-amber-500" />
        <AlertTitle>Caregiver Mode</AlertTitle>
        <AlertDescription>
          Manage health records for your loved ones. Switch between profiles to view
          and manage their health information.
        </AlertDescription>
      </Alert>

      <Card data-testid="card-managed-profiles">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Users className="h-5 w-5 text-amber-500" />
            Managed Profiles
          </CardTitle>
          <CardDescription>
            Health profiles you have access to manage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full justify-start h-auto py-4" asChild>
            <Link href="/profiles">
              <div className="flex items-center gap-3 w-full">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Heart className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-medium">View All Profiles</p>
                  <p className="text-sm text-muted-foreground">
                    Manage profiles you have access to
                  </p>
                </div>
                <ChevronRight className="h-5 w-5" />
              </div>
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="hover-elevate" data-testid="card-caregiver-dashboard">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              Care Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Overview of care activities and updates
            </p>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/caregiver-hub">
                View Dashboard
                <ChevronRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-access-management">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-500" />
              Access Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Manage your access permissions
            </p>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/caregiver-management">
                Manage Access
                <ChevronRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-quick-actions-caregiver">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Button variant="outline" className="h-auto py-3 flex-col gap-1" asChild>
              <Link href="/medications">
                <Pill className="h-5 w-5" />
                <span className="text-sm">Medications</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-1" asChild>
              <Link href="/timeline">
                <Calendar className="h-5 w-5" />
                <span className="text-sm">Appointments</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-1" asChild>
              <Link href="/messages">
                <MessageSquare className="h-5 w-5" />
                <span className="text-sm">Messages</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-1" asChild>
              <Link href="/documents">
                <FileText className="h-5 w-5" />
                <span className="text-sm">Documents</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PopulationDashboardContent() {
  const { populationType, config } = usePopulation();

  const renderPopulationContent = () => {
    switch (populationType) {
      case "geriatric":
        return <GeriatricQuickView />;
      case "pediatric":
        return <PediatricQuickView />;
      case "cancer":
        return <OncologyQuickView />;
      case "special_needs":
        return <AccessibilityQuickView />;
      case "caregiver":
        return <CaregiverQuickView />;
      default:
        return null;
    }
  };

  const Icon = config.icon;

  return (
    <div className="container max-w-4xl py-6 px-4 space-y-6" id="main-content">
      <PopulationBanner />

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Icon className={cn("h-8 w-8", config.color)} />
            {config.label} Dashboard
          </h1>
          <p className="text-lg text-muted-foreground">{config.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {renderPopulationContent()}
        </div>

        <div className="space-y-6">
          <PopulationSelector />
          <QuickAccessPanel />
        </div>
      </div>
    </div>
  );
}

export default function PopulationDashboard() {
  return (
    <PopulationDashboardWrapper userId="current-user">
      <PopulationDashboardContent />
    </PopulationDashboardWrapper>
  );
}
