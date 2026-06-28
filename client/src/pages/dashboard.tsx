import { useQuery } from "@tanstack/react-query";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useSEO, buildPageSchemas } from "@/hooks/use-seo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ClipboardList,
  Link2,
  FileText,
  ArrowRight,
  CheckCircle,
  Clock,
  AlertCircle,
  Sparkles,
  Calendar,
  Pill,
  Activity,
  UserPlus,
  Download,
  UploadCloud,
  ShieldCheck,
  LineChart,
  Stethoscope,
} from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { AiPatientChartSummaryWidget } from "@/components/ai-patient-chart-summary-widget";

interface EhrConnectionResponse {
  id: number;
  status: string;
  facilityName: string;
  platform: string;
  lastSyncAt: string | null;
}

interface DashboardSummary {
  upcomingAppointments: number;
  activeMedications: number;
  recentConditions: number;
  unreadMessages: number;
  recentLabs: number;
  lastSync?: string;
}

function DashboardPage() {
  useSEO({
    title: "Dashboard",
    description: "Your personal health records dashboard. View connected hospitals, recent records, medications, and AI-powered health insights in one secure timeline.",
    canonicalPath: "/dashboard",
    structuredData: buildPageSchemas({
      pageName: "Health Records Dashboard",
      pageDescription: "View connected hospitals, recent records, medications, and AI-powered health insights in one secure timeline.",
      pagePath: "/dashboard",
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Dashboard", path: "/dashboard" },
      ],
    }),
  });

  const { user } = useAuth();
  const firstName = user?.firstName || user?.name?.split(" ")[0] || "there";

  const { data: connections, isLoading: connectionsLoading } = useQuery<EhrConnectionResponse[]>({
    queryKey: ["/api/ehr-integration/connections"],
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<DashboardSummary>({
    queryKey: ["/api/dashboard"],
  });

  const connectedCount = connections?.filter((c) => c.status === "connected").length ?? 0;
  const lastSync = connections
    ?.filter((c) => c.lastSyncAt)
    .sort((a, b) => new Date(b.lastSyncAt!).getTime() - new Date(a.lastSyncAt!).getTime())[0]
    ?.lastSyncAt;

  const stats = [
    {
      label: "Appointments",
      value: summary?.upcomingAppointments ?? 0,
      icon: Calendar,
      testId: "stat-appointments",
    },
    {
      label: "Medications",
      value: summary?.activeMedications ?? 0,
      icon: Pill,
      testId: "stat-medications",
    },
    {
      label: "Lab Results",
      value: summary?.recentLabs ?? 0,
      icon: Activity,
      testId: "stat-labs",
    },
  ];

  const quickActions = [
    { id: "symptom-checker", title: "Symptom Checker", icon: Stethoscope, href: "/symptom-checker" },
    { id: "timeline", title: "Timeline", icon: Clock, href: "/timeline" },
    { id: "medications", title: "Medications", icon: Pill, href: "/medications" },
    { id: "labs", title: "Lab Results", icon: Activity, href: "/lab-results" },
    { id: "find-doctor", title: "Find a Doctor", icon: UserPlus, href: "/find-provider" },
    { id: "export", title: "Export PDF", icon: Download, href: "/care-packets" },
    { id: "ehr", title: "Connect EHR", icon: UploadCloud, href: "/fasten-connect" },
  ];

  const actionCards = [
    {
      title: "Update My Health History",
      description: "Enter your medical history, medications, allergies, and more",
      icon: ClipboardList,
      href: "/intake-history",
      color: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
      testId: "action-update-health-history",
    },
    {
      title: "Connect Health Records",
      description: "Securely import records from 25,000+ US healthcare providers via Fasten Health",
      icon: Link2,
      href: "/fasten-connect",
      color: "bg-green-500/15 text-green-600 dark:text-green-400",
      testId: "action-connect-health-records",
    },
    {
      title: "View My Records",
      description: "Access your complete medical records in one place",
      icon: FileText,
      href: "/documents",
      color: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
      testId: "action-view-records",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="space-y-1" data-testid="section-welcome">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="text-welcome-greeting">
            Welcome back, {firstName}
          </h1>
          <p className="text-muted-foreground" data-testid="text-welcome-subtitle">
            Manage your health records in one secure place.
          </p>
        </div>

        <AiPatientChartSummaryWidget />

        <div className="grid grid-cols-3 gap-3 sm:gap-4" data-testid="section-stats">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.testId} data-testid={stat.testId}>
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  {summaryLoading ? (
                    <Skeleton className="h-7 w-10" />
                  ) : (
                    <p className="text-2xl font-bold text-primary" data-testid={`${stat.testId}-value`}>
                      {stat.value}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="space-y-3" data-testid="section-quick-actions">
          <h2 className="text-base font-semibold">Quick Actions</h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.id} href={action.href} className="block">
                  <Card
                    className="hover-elevate cursor-pointer h-full"
                    data-testid={`button-action-${action.id}`}
                  >
                    <CardContent className="p-3 flex flex-col items-center text-center gap-2">
                      <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                      <p className="text-xs font-medium leading-tight">{action.title}</p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-testid="section-action-cards">
          {actionCards.map((action) => {
            const content = (
              <Card
                className="hover-elevate cursor-pointer h-full"
                data-testid={action.testId}
              >
                <CardContent className="p-5 sm:p-6 flex flex-col items-start gap-4 h-full">
                  <div className={`p-3 rounded-lg ${action.color}`}>
                    <action.icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <h2 className="font-semibold text-base" data-testid={`text-title-${action.testId}`}>
                      {action.title}
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed" data-testid={`text-desc-${action.testId}`}>
                      {action.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-medium text-primary">
                    Get started
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            );

            if (action.href) {
              return (
                <Link key={action.testId} href={action.href} className="block h-full">
                  {content}
                </Link>
              );
            }

            return <div key={action.testId} className="h-full">{content}</div>;
          })}
        </div>

        <Link href="/health-dashboard" className="block">
          <Card className="hover-elevate cursor-pointer" data-testid="link-health-trends">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                  <LineChart className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-semibold text-sm">View Health Trends</p>
                  <p className="text-xs text-muted-foreground">
                    Vitals charts: blood pressure, glucose, weight, heart rate
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        <Card data-testid="section-status">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              <Sparkles className="h-4 w-4 text-primary" />
              Account Status
            </CardTitle>
            <CardDescription>Your health records overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50" data-testid="status-ehr-connections">
                {connectionsLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <>
                    <div className="p-2 rounded-lg bg-green-500/15 text-green-600 dark:text-green-400">
                      {connectedCount > 0 ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">EHR Sources</p>
                      <p className="text-xs text-muted-foreground">
                        {connectedCount > 0
                          ? `${connectedCount} connected`
                          : "No sources connected"}
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50" data-testid="status-last-sync">
                {connectionsLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <>
                    <div className="p-2 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Last Sync</p>
                      <p className="text-xs text-muted-foreground">
                        {lastSync
                          ? new Date(lastSync).toLocaleDateString()
                          : "No syncs yet"}
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50" data-testid="status-onboarding">
                <div className="p-2 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400">
                  <ClipboardList className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Onboarding</p>
                  <p className="text-xs text-muted-foreground">
                    {connectedCount > 0 ? "Complete" : "Get started above"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div
          className="flex items-center justify-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/40 px-4 py-3"
          data-testid="banner-hipaa"
        >
          <ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
          <p className="text-xs text-emerald-800 dark:text-emerald-300">
            Your data is protected with HIPAA-compliant encryption
          </p>
        </div>

        <ClinicalDisclaimer variant="compact" className="px-4" testId="text-disclaimer" />
      </div>
    </div>
  );
}

export default DashboardPage;
