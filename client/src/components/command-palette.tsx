import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useTefcaEnabled } from "@/hooks/use-tefca";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  LayoutDashboard, HeartPulse, Link2, Flower2, Baby, ShieldCheck,
  HeartHandshake, Timer, ScrollText, PawPrint, Clock, FileText, FileOutput,
  Search, Bell, CreditCard, Receipt, Smartphone, Heart,
  Sparkles, Bot, BookOpen, Target, ClipboardList, Mic, Languages, DollarSign,
  MessageSquare, Video, Users, ClipboardCheck, Stethoscope, Trophy,
  Settings, Shield, Eye, WifiOff, Accessibility,
  ArrowRight, CheckCheck, Moon, Sun, LogOut, Home,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CommandAction {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords?: string;
  action: () => void;
  shortcut?: string;
}

interface CommandSection {
  heading: string;
  items: CommandAction[];
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open]);

  const go = useCallback((url: string) => {
    setOpen(false);
    setLocation(url);
  }, [setLocation]);

  const tefcaEnabled = useTefcaEnabled();

  const sections: CommandSection[] = [
    {
      heading: "Quick Actions",
      items: [
        {
          id: "action-home",
          title: "Go to Dashboard",
          icon: Home,
          keywords: "home main",
          action: () => go("/"),
          shortcut: "⌘H",
        },
        {
          id: "action-acknowledge-alerts",
          title: "Acknowledge All Alerts",
          icon: CheckCheck,
          keywords: "acknowledge dismiss alerts notifications clear",
          action: () => {
            setOpen(false);
            toast({ title: "Alerts Acknowledged", description: "All active alerts have been marked as read." });
          },
        },
        {
          id: "action-toggle-theme",
          title: "Toggle Dark Mode",
          icon: Moon,
          keywords: "theme dark light mode appearance",
          action: () => {
            setOpen(false);
            const root = document.documentElement;
            const isDark = root.classList.contains("dark");
            root.classList.toggle("dark", !isDark);
            localStorage.setItem("theme", isDark ? "light" : "dark");
            toast({ title: isDark ? "Light Mode" : "Dark Mode", description: `Switched to ${isDark ? "light" : "dark"} mode.` });
          },
        },
        {
          id: "action-search",
          title: "Search Records",
          icon: Search,
          keywords: "find lookup query",
          action: () => go("/search"),
          shortcut: "⌘F",
        },
        {
          id: "action-logout",
          title: "Log Out",
          icon: LogOut,
          keywords: "sign out exit session",
          action: () => { setOpen(false); window.location.href = "/api/logout"; },
        },
      ],
    },
    {
      heading: "Health Records",
      items: [
        { id: "nav-health-record", title: "My Health Record", icon: HeartPulse, keywords: "medical records health data", action: () => go("/my-health-record") },
        { id: "nav-patient-viewer", title: "Patient Record Viewer", icon: Eye, keywords: "fhir r4 tefca patient viewer conditions medications observations vitals labs pdf download health record", action: () => go("/patient-viewer") },
        { id: "nav-connect", title: "Connect Health Records", icon: Link2, keywords: "ehr epic fhir fasten import", action: () => go("/fasten-connect") },
        { id: "nav-timeline", title: "Timeline", icon: Clock, keywords: "history chronological events", action: () => go("/timeline") },
        { id: "nav-documents", title: "Documents", icon: FileText, keywords: "files uploads reports", action: () => go("/documents") },
        { id: "nav-share", title: "Share / Export", icon: FileOutput, keywords: "care packets send export pdf", action: () => go("/care-packets") },
      ],
    },
    {
      heading: "Women's Health",
      items: [
        { id: "nav-womens-health", title: "Women's Health", icon: Flower2, keywords: "gynecology reproductive", action: () => go("/womens-health") },
        { id: "nav-fertility", title: "Fertility & Cycle", icon: Baby, keywords: "period menstrual ovulation tracking", action: () => go("/fertility-cycle") },
        { id: "nav-menopause", title: "Menopause Resilience", icon: HeartPulse, keywords: "perimenopause hormones bone density", action: () => go("/menopause-resilience") },
      ],
    },
    {
      heading: "Health Tools",
      items: [
        { id: "nav-ai-advisor", title: "AI Health Advisor", icon: Sparkles, keywords: "artificial intelligence advice", action: () => go("/ai-health-advisor") },
        { id: "nav-assistant", title: "Health Assistant", icon: Bot, keywords: "chatbot ai help", action: () => go("/health-assistant") },
        { id: "nav-journal", title: "Health Journal", icon: BookOpen, keywords: "diary log symptoms", action: () => go("/health-journal") },
        { id: "nav-goals", title: "Health Goals", icon: Target, keywords: "fitness wellness targets", action: () => go("/health-goals") },
        { id: "nav-scribe", title: "Record Visit", icon: ClipboardList, keywords: "medical scribe doctor appointment", action: () => go("/medical-scribe") },
        { id: "nav-screening", title: "Preventive Screening", icon: ShieldCheck, keywords: "cancer checkup preventive care", action: () => go("/preventive-screening") },
        { id: "nav-voice", title: "Voice Access", icon: Mic, keywords: "speech talk", action: () => go("/voice-access") },
        { id: "nav-translation", title: "Document Translation", icon: Languages, keywords: "translate language", action: () => go("/document-translation") },
        { id: "nav-drug-savings", title: "Drug Savings", icon: DollarSign, keywords: "medication cost prescription", action: () => go("/drug-savings") },
        { id: "nav-ascvd", title: "ASCVD Risk Calculator", icon: HeartHandshake, keywords: "cardiovascular heart risk", action: () => go("/ascvd-calculator") },
        { id: "nav-longevity", title: "Longevity Tracking", icon: Timer, keywords: "aging lifespan healthspan", action: () => go("/longevity-tracking") },
        { id: "nav-directives", title: "Advance Directives", icon: ScrollText, keywords: "living will power attorney", action: () => go("/advance-directives") },
        { id: "nav-audit", title: "Clinical AI Audit", icon: ShieldCheck, keywords: "med-gemini safety confidence trust", action: () => go("/clinical-ai-audit") },
      ],
    },
    {
      heading: "Care & Communication",
      items: [
        { id: "nav-messages", title: "Messages", icon: MessageSquare, keywords: "inbox chat secure messaging", action: () => go("/messages") },
        { id: "nav-telehealth", title: "Telehealth", icon: Video, keywords: "video call telemedicine virtual visit", action: () => go("/patient-telehealth-portal") },
        { id: "nav-care-team", title: "Care Team", icon: Users, keywords: "doctors providers team", action: () => go("/care-team-hub") },
        { id: "nav-care-plans", title: "Care Plans", icon: ClipboardCheck, keywords: "treatment plan collaborative", action: () => go("/collaborative-care-plans") },
        { id: "nav-family", title: "My Family", icon: Users, keywords: "family members caregiver dependents", action: () => go("/my-family") },
        { id: "nav-provider", title: "Find a Provider", icon: Stethoscope, keywords: "doctor specialist find locate", action: () => go("/find-provider") },
        { id: "nav-npi", title: "NPI Lookup", icon: Search, keywords: "npi national provider identifier registry cms verify", action: () => go("/npi-lookup") },
        { id: "nav-compliance-export", title: "Compliance Export", icon: Shield, keywords: "compliance export tefca audit pdf csv encrypted hipaa soc2 phi", action: () => go("/compliance-export") },
        { id: "nav-network-health", title: "Network Health", icon: Activity, keywords: "network health status endpoint uptime latency traffic light monitor partner qhin", action: () => go("/network-health") },
      ],
    },
    {
      heading: "Billing & Insurance",
      items: [
        { id: "nav-billing", title: "Billing", icon: CreditCard, keywords: "payment charges account", action: () => go("/billing") },
        { id: "nav-bills-eob", title: "Bills & EOBs", icon: Receipt, keywords: "explanation benefits statements", action: () => go("/bills-eob") },
        { id: "nav-insurance", title: "Insurance Card", icon: Smartphone, keywords: "insurance upload id card", action: () => go("/insurance-card-upload") },
        { id: "nav-claims", title: "Claim Forms", icon: FileText, keywords: "cms 1500 insurance claim submit", action: () => go("/cms-1500") },
        { id: "nav-savings", title: "Savings & Resources", icon: Heart, keywords: "uninsured financial assistance", action: () => go("/uninsured-resources") },
        { id: "nav-enterprise", title: "Enterprise Savings", icon: DollarSign, keywords: "employer benefits", action: () => go("/enterprise-savings") },
      ],
    },
    {
      heading: "Settings & System",
      items: [
        { id: "nav-settings", title: "Settings", icon: Settings, keywords: "preferences configuration", action: () => go("/settings") },
        { id: "nav-notifications", title: "Notifications", icon: Bell, keywords: "alerts reminders", action: () => go("/notifications") },
        { id: "nav-accessibility", title: "Accessibility", icon: Accessibility, keywords: "a11y contrast screen reader", action: () => go("/accessibility") },
        { id: "nav-security", title: "Security", icon: Shield, keywords: "password mfa two factor", action: () => go("/security") },
        { id: "nav-privacy", title: "Privacy Policy", icon: Eye, keywords: "data privacy policy", action: () => go("/privacy-policy") },
        { id: "nav-offline", title: "Offline Mode", icon: WifiOff, keywords: "offline cache sync", action: () => go("/offline") },
        { id: "nav-pet-health", title: "Pet Health Records", icon: PawPrint, keywords: "pet veterinary animal", action: () => go("/pet-health-records") },
        { id: "nav-rewards", title: "Rewards", icon: Trophy, keywords: "achievements gamification points", action: () => go("/rewards") },
        { id: "nav-assessments", title: "Assessments", icon: ClipboardList, keywords: "questionnaire survey form", action: () => go("/assessments") },
      ],
    },
  ];

  // Hide TEFCA/Fasten-only commands on the international (.world) deployment.
  const TEFCA_ONLY_COMMAND_IDS = new Set(["nav-connect", "nav-compliance-export", "nav-network-health"]);
  const visibleSections = tefcaEnabled
    ? sections
    : sections
        .map((s) => ({ ...s, items: s.items.filter((i) => !TEFCA_ONLY_COMMAND_IDS.has(i.id)) }))
        .filter((s) => s.items.length > 0);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden md:inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/60 transition-colors"
        data-testid="button-command-palette-trigger"
        aria-label="Open command palette"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search...</span>
        <kbd className="pointer-events-none ml-1 inline-flex h-5 items-center gap-0.5 rounded border border-border/80 bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages, actions, settings..." data-testid="input-command-palette" />
        <CommandList className="max-h-[400px]">
          <CommandEmpty>No results found.</CommandEmpty>

          {visibleSections.map((section, sIdx) => (
            <div key={section.heading}>
              {sIdx > 0 && <CommandSeparator />}
              <CommandGroup heading={section.heading}>
                {section.items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.title} ${item.keywords || ""}`}
                    onSelect={() => item.action()}
                    data-testid={`command-item-${item.id}`}
                    className="cursor-pointer"
                  >
                    <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{item.title}</span>
                    {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
