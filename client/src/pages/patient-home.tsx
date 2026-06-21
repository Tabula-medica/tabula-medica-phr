import { useSEO } from "@/hooks/use-seo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Pill, 
  FileText, 
  Clock, 
  Calendar,
  Share2,
  Plus,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  Siren,
  Stethoscope,
  Phone,
} from "lucide-react";
import { Link } from "wouter";
import { useAccessibility } from "@/components/accessibility-provider";

interface HomeSection {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  addHref?: string;
  shareHref?: string;
  color: string;
  count?: number;
  urgent?: boolean;
  urgentLabel?: string;
}

const homeSections: HomeSection[] = [
  {
    id: "profiles",
    title: "My Profiles",
    description: "Manage your health profiles and family members",
    icon: Users,
    href: "/profiles",
    addHref: "/profiles",
    shareHref: "/care-packets",
    color: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
    count: 3,
  },
  {
    id: "meds",
    title: "My Meds",
    description: "View and track your medications",
    icon: Pill,
    href: "/medications",
    addHref: "/medications",
    shareHref: "/care-packets",
    color: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
    count: 5,
    urgent: true,
    urgentLabel: "Refill soon",
  },
  {
    id: "documents",
    title: "My Documents",
    description: "Access your health records and test results",
    icon: FileText,
    href: "/documents",
    addHref: "/document-upload",
    shareHref: "/care-packets",
    color: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30",
    count: 24,
  },
  {
    id: "timeline",
    title: "My Timeline",
    description: "See your complete health history",
    icon: Clock,
    href: "/timeline",
    addHref: "/timeline",
    shareHref: "/care-packets",
    color: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  {
    id: "followups",
    title: "My Follow-ups",
    description: "Track appointments and care reminders",
    icon: Calendar,
    href: "/survivorship",
    addHref: "/survivorship",
    shareHref: "/care-packets",
    color: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
    count: 2,
    urgent: true,
    urgentLabel: "Due soon",
  },
  {
    id: "share",
    title: "Share / Export",
    description: "Create care packets for your providers",
    icon: Share2,
    href: "/care-packets",
    color: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
  },
];

function WelcomeHeader() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <span className="text-sm font-medium text-primary">Tabula Medica</span>
      </div>
      <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-greeting">{greeting}</h1>
      <p className="text-muted-foreground mt-1" data-testid="text-welcome-subtext">
        Your health records, all in one place.
      </p>
    </div>
  );
}

function HomeSectionCard({ section }: { section: HomeSection }) {
  const hasAddAndShare = section.addHref && section.shareHref;
  
  return (
    <Card 
      className="hover-elevate relative overflow-visible"
      data-testid={`card-home-${section.id}`}
    >
      <Link href={section.href}>
        <CardHeader className="pb-2 cursor-pointer">
          <div className="flex items-start justify-between gap-2">
            <div className={`p-3 rounded-xl ${section.color}`}>
              <section.icon className="h-6 w-6" />
            </div>
            <div className="flex items-center gap-2">
              {section.urgent && section.urgentLabel && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {section.urgentLabel}
                </Badge>
              )}
              {section.count !== undefined && (
                <Badge variant="secondary">{section.count}</Badge>
              )}
            </div>
          </div>
          <CardTitle className="text-lg mt-3">{section.title}</CardTitle>
          <CardDescription className="text-sm">{section.description}</CardDescription>
        </CardHeader>
      </Link>
      
      <CardContent className="pt-0">
        <div className="flex items-center gap-2">
          {hasAddAndShare ? (
            <>
              <Button 
                size="sm" 
                asChild
                data-testid={`button-add-${section.id}`}
              >
                <Link href={section.addHref!}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Link>
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                asChild
                data-testid={`button-share-${section.id}`}
              >
                <Link href={section.shareHref!}>
                  <Share2 className="h-4 w-4 mr-1" />
                  Export
                </Link>
              </Button>
            </>
          ) : (
            <Button 
              size="sm" 
              asChild
              data-testid={`button-open-${section.id}`}
            >
              <Link href={section.href}>
                Open
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionsBar() {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-medium text-muted-foreground mb-3">Quick Actions</h2>
      <div className="flex flex-wrap gap-2">
        <Button 
          variant="destructive" 
          asChild
          data-testid="button-quick-er-packet"
        >
          <Link href="/care-packets?type=er_visit">
            <Siren className="h-4 w-4 mr-2" />
            ER Packet
          </Link>
        </Button>
        <Button 
          variant="outline" 
          asChild
          data-testid="button-quick-new-provider"
        >
          <Link href="/care-packets?type=primary_care">
            <Stethoscope className="h-4 w-4 mr-2" />
            New Provider
          </Link>
        </Button>
        <Button 
          variant="secondary" 
          asChild
          data-testid="button-quick-share"
        >
          <Link href="/care-packets">
            <Share2 className="h-4 w-4 mr-2" />
            Share Records
          </Link>
        </Button>
      </div>
    </div>
  );
}

function NoCDSDisclaimer() {
  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mt-6" data-testid="disclaimer-no-cds">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
            For Information Only
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            This app helps you organize your health records. It does NOT provide medical advice. 
            Always consult your healthcare provider for medical decisions.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PatientHomeDashboard() {
  useSEO({
    title: "Home - Tabula Medica",
    description: "Your unified health record dashboard"
  });

  const { settings } = useAccessibility();
  const isGeriatricMode = settings.geriatricMode;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <WelcomeHeader />
        
        <QuickActionsBar />
        
        <div className={`grid gap-4 ${isGeriatricMode ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
          {homeSections.map((section) => (
            <HomeSectionCard key={section.id} section={section} />
          ))}
        </div>

        <NoCDSDisclaimer />
      </div>
    </div>
  );
}
