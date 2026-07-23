import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useLanguage } from "@/components/language-provider";
import { useRegion } from "@/components/region-provider";
import { useTefcaEnabled } from "@/hooks/use-tefca";
import { 
  LayoutDashboard, 
  Clock, 
  Settings,
  Heart,
  DollarSign,
  Activity,
  CheckCircle,
  FileText,
  Users,
  Shield,
  Stethoscope,
  BookOpen,
  Bot,
  Eye,
  MessageSquare,
  Trophy,
  ClipboardList,
  ClipboardCheck,
  Bell,
  Search,
  Video,
  BarChart3,
  ShieldCheck,
  Accessibility,
  Sparkles,
  Target,
  Mic,
  Languages,
  ChevronDown,
  ChevronRight,
  Database,
  HeartPulse,
  UserCircle,
  CreditCard,
  WifiOff,
  FileOutput,
  Link2,
  Info,
  PawPrint,
  ShieldAlert,
  Receipt,
  Smartphone,
  Flower2,
  HeartHandshake,
  Timer,
  ScrollText,
  TrendingDown,
  Baby,
  Hash,
  Globe,
  Stethoscope as StethoscopeIcon,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarMenuBadge,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import type { EhrConnection } from "@shared/schema";

const mainNavItems = [
  {
    title: "Home",
    titleKey: "nav.home",
    url: "/",
    icon: LayoutDashboard,
    badge: null,
  },
  {
    title: "Health Summary",
    titleKey: "nav.healthSummary",
    url: "#health-summary",
    icon: BookOpen,
    badge: null,
  },
  {
    title: "Health Profile Setup",
    titleKey: "sidebar.healthProfileSetup",
    url: "/comprehensive-onboarding",
    icon: ClipboardCheck,
    badge: "new",
  },
  {
    title: "My Health Record",
    titleKey: "sidebar.myHealthRecord",
    url: "/my-health-record",
    icon: HeartPulse,
    badge: null,
  },
  {
    title: "Connect Health Records",
    titleKey: "sidebar.connectHealthRecords",
    url: "/fasten-connect",
    icon: Link2,
    badge: null,
    requiresTefca: true,
  },
  {
    title: "Symptom Checker",
    titleKey: "sidebar.symptomChecker",
    url: "/symptom-checker",
    icon: StethoscopeIcon,
    badge: "free",
  },
  {
    title: "Patient Record Viewer",
    url: "/patient-viewer",
    icon: Eye,
    badge: "new",
  },
  {
    title: "Women's Health",
    titleKey: "sidebar.womensHealth",
    url: "/womens-health",
    icon: Flower2,
    badge: "new",
  },
  {
    title: "Fertility & Cycle",
    titleKey: "sidebar.fertilityCycle",
    url: "/fertility-cycle",
    icon: Baby,
    badge: "new",
  },
  {
    title: "Menopause Resilience",
    titleKey: "sidebar.menopauseResilience",
    url: "/menopause-resilience",
    icon: HeartPulse,
    badge: "new",
  },
  {
    title: "Clinical AI Audit",
    titleKey: "sidebar.clinicalAiAudit",
    url: "/clinical-ai-audit",
    icon: ShieldCheck,
    badge: "new",
  },
  {
    title: "ASCVD Risk Calculator",
    titleKey: "sidebar.ascvdCalculator",
    url: "/ascvd-calculator",
    icon: HeartHandshake,
    badge: "new",
  },
  {
    title: "Longevity Tracking",
    titleKey: "sidebar.longevityTracking",
    url: "/longevity-tracking",
    icon: Timer,
    badge: "new",
  },
  {
    title: "Advance Directives",
    titleKey: "sidebar.advanceDirectives",
    url: "/advance-directives",
    icon: ScrollText,
    badge: "new",
  },
  {
    title: "Pet Health Records",
    titleKey: "sidebar.petHealthRecords",
    url: "/pet-health-records",
    icon: PawPrint,
    badge: null,
  },
  {
    title: "Timeline",
    titleKey: "nav.timeline",
    url: "/timeline",
    icon: Clock,
    badge: null,
  },
  {
    title: "Documents",
    titleKey: "nav.documents",
    url: "/documents",
    icon: FileText,
    badge: null,
  },
  {
    title: "Share / Export",
    titleKey: "sidebar.shareExport",
    url: "/care-packets",
    icon: FileOutput,
    badge: null,
  },
];

const globalAccessItems = [
  {
    title: "Search",
    titleKey: "nav.search",
    url: "/search",
    icon: Search,
    badge: null,
  },
  {
    title: "Notifications",
    titleKey: "sidebar.notifications",
    url: "/notifications",
    icon: Bell,
    badge: null,
  },
  {
    title: "Billing",
    titleKey: "sidebar.billing",
    url: "/billing",
    icon: CreditCard,
    badge: null,
  },
  {
    title: "Health Record",
    titleKey: "sidebar.phrPipeline",
    url: "/phr-pipeline",
    icon: Database,
    badge: "new",
  },
  {
    title: "My Records",
    titleKey: "sidebar.healthRecords",
    url: "/health-records",
    icon: TestTubes,
    badge: "new",
  },
  {
    title: "Find Free Care",
    titleKey: "sidebar.fqhcFinder",
    url: "/find-free-care",
    icon: Heart,
    badge: "new",
  },
  {
    title: "Dual-Mode Ecosystem",
    titleKey: "sidebar.dualMode",
    url: "/dual-mode",
    icon: ArrowLeftRight,
    badge: "new",
  },
  {
    title: "NMN + Auth0 SMART",
    titleKey: "sidebar.nmnAuth0",
    url: "/nmn-auth0",
    icon: Shield,
    badge: "new",
  },
  {
    title: "Subscription",
    titleKey: "sidebar.subscription",
    url: "/subscription",
    icon: Crown,
    badge: null,
  },
  {
    title: "Bills & EOBs",
    titleKey: "sidebar.billsEobs",
    url: "/bills-eob",
    icon: Receipt,
    badge: "new",
  },
  {
    title: "Insurance Card",
    titleKey: "sidebar.insuranceCard",
    url: "/insurance-card-upload",
    icon: Smartphone,
    badge: "new",
  },
  {
    title: "Claim Forms",
    titleKey: "sidebar.claimForms",
    url: "/cms-1500",
    icon: FileText,
    badge: "new",
  },
  {
    title: "Savings & Resources",
    titleKey: "sidebar.savingsResources",
    url: "/uninsured-resources",
    icon: Heart,
    badge: null,
  },
];

const healthToolsItems = [
  {
    title: "AI Health Advisor",
    url: "/ai-health-advisor",
    icon: Sparkles,
    badge: "ai",
  },
  {
    title: "Health Assistant",
    url: "/health-assistant",
    icon: Bot,
    badge: "ai",
  },
  {
    title: "Health Journal",
    url: "/health-journal",
    icon: BookOpen,
    badge: null,
  },
  {
    title: "Health Goals",
    url: "/health-goals",
    icon: Target,
    badge: null,
  },
  {
    title: "Record Visit",
    url: "/medical-scribe",
    icon: ClipboardList,
    badge: "ai",
  },
  {
    title: "Visit Summary",
    url: "/visit-summary",
    icon: FileText,
    badge: "ai",
  },
  {
    title: "Preventive Screening",
    url: "/preventive-screening",
    icon: ShieldCheck,
    badge: null,
  },
  {
    title: "Voice Access",
    url: "/voice-access",
    icon: Mic,
    badge: "ai",
  },
  {
    title: "Document Translation",
    url: "/document-translation",
    icon: Languages,
    badge: "ai",
  },
  {
    title: "Drug Savings",
    url: "/drug-savings",
    icon: DollarSign,
    badge: null,
  },
  {
    title: "Learn",
    url: "/learn",
    icon: BookOpen,
    badge: null,
  },
  {
    title: "QOCA AIoT",
    url: "/qoca-aiot",
    icon: Smartphone,
    badge: "ai",
  },
];

const careItems = [
  {
    title: "Messages",
    url: "/messages",
    icon: MessageSquare,
    badge: "messages",
  },
  {
    title: "Telehealth",
    url: "/patient-telehealth-portal",
    icon: Video,
    badge: null,
  },
  {
    title: "Care Team",
    url: "/care-team-hub",
    icon: Users,
    badge: null,
  },
  {
    title: "Care Plans",
    url: "/collaborative-care-plans",
    icon: ClipboardCheck,
    badge: null,
  },
  {
    title: "My Family",
    url: "/my-family",
    icon: Users,
    badge: "new",
  },
  {
    title: "Find a Provider",
    url: "/find-provider",
    icon: Stethoscope,
    badge: null,
  },
  {
    title: "NPI Lookup",
    url: "/npi-lookup",
    icon: Hash,
    badge: "new",
  },
  {
    title: "Community",
    url: "/community",
    icon: Users,
    badge: null,
  },
];

const engagementItems = [
  {
    title: "Assessments",
    url: "/assessments",
    icon: ClipboardList,
    badge: "due",
  },
  {
    title: "Rewards",
    url: "/rewards",
    icon: Trophy,
    badge: null,
  },
];

const settingsItems = [
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
  {
    title: "Accessibility",
    url: "/accessibility",
    icon: Accessibility,
  },
  {
    title: "Security",
    url: "/security",
    icon: Shield,
  },
  {
    title: "Privacy",
    url: "/privacy-policy",
    icon: Eye,
  },
  {
    title: "Offline Mode",
    url: "/offline",
    icon: WifiOff,
  },
  {
    title: "FAQ",
    url: "/faq",
    icon: MessageSquare,
  },
];

const adminItems = [
  {
    title: "Provider Portal",
    url: "/provider-portal",
    icon: Activity,
  },
  {
    title: "Clinician Dashboard",
    url: "/clinician-dashboard",
    icon: Stethoscope,
  },
  {
    title: "Patients",
    url: "/patients",
    icon: ClipboardList,
  },
  {
    title: "Admin Analytics",
    url: "/admin-analytics",
    icon: BarChart3,
  },
  {
    title: "Internal Analytics",
    url: "/internal-analytics",
    icon: Activity,
    badge: "new",
  },
  {
    title: "Extraction Pipeline",
    url: "/extraction-pipeline",
    icon: ScrollText,
    badge: "new",
  },
  {
    title: "Platform Savings",
    url: "/enterprise-savings",
    icon: TrendingDown,
    badge: "new",
  },
  {
    title: "Data Integration",
    url: "/data-integration-hub",
    icon: Database,
  },
  {
    title: "Compliance",
    url: "/compliance-dashboard",
    icon: ShieldCheck,
  },
  {
    title: "Audit Visualization",
    url: "/audit-visualization",
    icon: BarChart3,
    badge: "new",
  },
  {
    title: "FHIR API Data Hub",
    url: "/fhir-data-hub",
    icon: Globe,
    badge: "new",
  },
  {
    title: "Compliance Export",
    url: "/compliance-export",
    icon: FileOutput,
    badge: "new",
  },
  {
    title: "Network Health",
    url: "/network-health",
    icon: Activity,
    badge: "new",
  },
  {
    title: "Partner Onboarding",
    url: "/data-source-onboarding",
    icon: Database,
    badge: "new",
  },
  {
    title: "USCDI v3",
    url: "/uscdi-v3-compliance",
    icon: Shield,
    usOnly: true,
  },
];

// Reusable badge component for nav items
function NavItemBadge({ badge, connectedCount, unreadMessageCount, dueAssessmentCount }: { 
  badge: string | null; 
  connectedCount: number; 
  unreadMessageCount: number; 
  dueAssessmentCount: number;
}) {
  if (!badge) return null;
  
  if (badge === "connections" && connectedCount > 0) {
    return (
      <SidebarMenuBadge>
        <Badge variant="secondary">{connectedCount}</Badge>
      </SidebarMenuBadge>
    );
  }
  if (badge === "messages" && unreadMessageCount > 0) {
    return (
      <SidebarMenuBadge>
        <Badge variant="destructive" className="text-[10px] px-1.5" data-testid="badge-sidebar-unread-messages">
          {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
        </Badge>
      </SidebarMenuBadge>
    );
  }
  if (badge === "new") {
    return (
      <SidebarMenuBadge>
        <Badge className="bg-primary/20 text-primary text-[10px] px-1.5">New</Badge>
      </SidebarMenuBadge>
    );
  }
  if (badge === "ai") {
    return (
      <SidebarMenuBadge>
        <Badge className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-[10px] px-1.5">AI</Badge>
      </SidebarMenuBadge>
    );
  }
  if (badge === "due" && dueAssessmentCount > 0) {
    return (
      <SidebarMenuBadge>
        <Badge variant="destructive" className="text-[10px] px-1.5" data-testid="badge-due-assessments">
          {dueAssessmentCount}
        </Badge>
      </SidebarMenuBadge>
    );
  }
  return null;
}

function SectionHeader({ 
  icon: Icon, 
  title, 
  itemCount, 
  isOpen, 
  testId,
  accentColor = "primary"
}: { 
  icon: any; 
  title: string; 
  itemCount: number; 
  isOpen: boolean; 
  testId: string;
  accentColor?: "primary" | "yellow" | "emerald" | "purple";
}) {
  const colorClasses = {
    primary: "text-primary",
    yellow: "text-yellow-500",
    emerald: "text-emerald-500",
    purple: "text-purple-500"
  };
  
  return (
    <SidebarGroupLabel 
      className="text-xs font-semibold uppercase tracking-wider cursor-pointer hover-elevate flex items-center justify-between w-full pr-2 py-2" 
      data-testid={testId}
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${colorClasses[accentColor]}`} />
        <span>{title}</span>
        {!isOpen && itemCount > 0 && (
          <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 h-4 opacity-60">
            {itemCount}
          </Badge>
        )}
      </div>
      <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
    </SidebarGroupLabel>
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const tefcaEnabled = useTefcaEnabled();
  const mainNavItemsForRegion = mainNavItems.filter(
    (item) => tefcaEnabled || !(item as { requiresTefca?: boolean }).requiresTefca,
  );
  const [healthToolsOpen, setHealthToolsOpen] = useState(false);
  const [careOpen, setCareOpen] = useState(false);
  const [engagementOpen, setEngagementOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  const { data: connections } = useQuery<EhrConnection[]>({
    queryKey: ['/api/ehr-connections'],
  });

  const { data: unreadData } = useQuery<{ unreadCount: number }>({
    queryKey: ['/api/messages/unread-count'],
    refetchInterval: 30000,
  });

  const { data: dueAssessments = [] } = useQuery<any[]>({
    queryKey: ['/api/prom/due'],
    refetchInterval: 60000,
  });

  const connectedCount = connections?.filter(c => c.status === 'connected').length ?? 0;
  const unreadMessageCount = unreadData?.unreadCount ?? 0;
  const dueAssessmentCount = dueAssessments.length;

  const { t } = useLanguage();
  const { isUS } = useRegion();

  const filteredAdminItems = useMemo(
    () => adminItems.filter((item) => !("usOnly" in item && item.usOnly) || isUS),
    [isUS]
  );

  const renderNavItem = (item: { title: string; titleKey?: string; url: string; icon: any; badge?: string | null }) => {
    if (item.url === "#health-summary") {
      return (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton
            onClick={() => window.dispatchEvent(new CustomEvent("open-health-summary"))}
            data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.titleKey ? t(item.titleKey) : item.title}</span>
          </SidebarMenuButton>
          <NavItemBadge
            badge={item.badge || null}
            connectedCount={connectedCount}
            unreadMessageCount={unreadMessageCount}
            dueAssessmentCount={dueAssessmentCount}
          />
        </SidebarMenuItem>
      );
    }
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild isActive={location === item.url}>
          <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
            <item.icon className="h-4 w-4" />
            <span>{item.titleKey ? t(item.titleKey) : item.title}</span>
          </Link>
        </SidebarMenuButton>
        <NavItemBadge 
          badge={item.badge || null} 
          connectedCount={connectedCount} 
          unreadMessageCount={unreadMessageCount} 
          dueAssessmentCount={dueAssessmentCount} 
        />
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4 space-y-3">
        <Link href="/" className="flex items-center group" data-testid="link-sidebar-logo">
          <img src="/logo.png" alt="Tabula Medica" className="h-12 drop-shadow-sm group-hover:scale-[1.02] transition-transform duration-200" />
        </Link>
        
        {/* Profile Switcher - Global Access */}
        <Link 
          href="/profiles" 
          className="flex items-center gap-2 p-2 rounded-lg bg-sidebar-accent/50 hover-elevate transition-colors"
          data-testid="link-profile-switcher"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <UserCircle className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" data-testid="text-profile-switcher-label">Active Profile</p>
            <p className="text-xs text-muted-foreground" data-testid="text-profile-switcher-hint">Switch profiles</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </SidebarHeader>
      
      <SidebarContent>
        {/* Primary Navigation - 5 Main Areas */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider">Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItemsForRegion.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Global Access */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider">{t("sidebar.quickAccess")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {globalAccessItems.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Health Tools & AI - Collapsible */}
        <SidebarGroup className="border-t border-sidebar-border/50">
          <Collapsible open={healthToolsOpen} onOpenChange={setHealthToolsOpen}>
            <CollapsibleTrigger asChild>
              <SectionHeader 
                icon={Sparkles} 
                title="Health Tools" 
                itemCount={healthToolsItems.length} 
                isOpen={healthToolsOpen}
                testId="toggle-health-tools"
                accentColor="yellow"
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="animate-in slide-in-from-top-2 duration-200">
              <SidebarGroupContent>
                <SidebarMenu>
                  {healthToolsItems.map(renderNavItem)}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* Care & Communication - Collapsible */}
        <SidebarGroup className="border-t border-sidebar-border/50">
          <Collapsible open={careOpen} onOpenChange={setCareOpen}>
            <CollapsibleTrigger asChild>
              <SectionHeader 
                icon={Users} 
                title="Care & Communication" 
                itemCount={careItems.length} 
                isOpen={careOpen}
                testId="toggle-care"
                accentColor="emerald"
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="animate-in slide-in-from-top-2 duration-200">
              <SidebarGroupContent>
                <SidebarMenu>
                  {careItems.map(renderNavItem)}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* Engagement & Rewards - Collapsible */}
        <SidebarGroup className="border-t border-sidebar-border/50">
          <Collapsible open={engagementOpen} onOpenChange={setEngagementOpen}>
            <CollapsibleTrigger asChild>
              <SectionHeader 
                icon={Trophy} 
                title="Engagement" 
                itemCount={engagementItems.length} 
                isOpen={engagementOpen}
                testId="toggle-engagement"
                accentColor="purple"
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="animate-in slide-in-from-top-2 duration-200">
              <SidebarGroupContent>
                <SidebarMenu>
                  {engagementItems.map(renderNavItem)}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* Admin - Collapsible */}
        <SidebarGroup className="border-t border-sidebar-border/50">
          <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
            <CollapsibleTrigger asChild>
              <SectionHeader 
                icon={ShieldAlert} 
                title="Admin" 
                itemCount={filteredAdminItems.length} 
                isOpen={adminOpen}
                testId="toggle-admin"
                accentColor="primary"
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="animate-in slide-in-from-top-2 duration-200">
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredAdminItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={location === item.url}>
                        <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* System - Collapsible */}
        <SidebarGroup className="border-t border-sidebar-border/50">
          <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
            <CollapsibleTrigger asChild>
              <SectionHeader 
                icon={Settings} 
                title="System" 
                itemCount={settingsItems.length} 
                isOpen={settingsOpen}
                testId="toggle-system"
                accentColor="primary"
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="animate-in slide-in-from-top-2 duration-200">
              <SidebarGroupContent>
                <SidebarMenu>
                  {settingsItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={location === item.url}>
                        <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase()}`}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-2">
        <div className="flex items-center gap-2 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-800/40 px-3 py-2" data-testid="sidebar-disclaimer">
          <Info className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span className="text-[10px] leading-tight text-amber-700 dark:text-amber-300">Free for patients. Not clinical advice — a longitudinal health record</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/5 p-3 border border-green-500/10">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/15">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-green-700 dark:text-green-400">{t("sidebar.systemOnline")}</span>
            <span className="text-xs text-muted-foreground">{t("sidebar.allServicesOperational")}</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
