import { useState, useEffect, createContext, useContext, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccessibility } from "@/components/accessibility-provider";
import { VoiceNavigationControl } from "@/components/voice-navigation-control";
import {
  Baby,
  Heart,
  Ribbon,
  Accessibility,
  User,
  Users,
  Eye,
  Volume2,
  Type,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type PopulationType = "general" | "geriatric" | "pediatric" | "cancer" | "special_needs" | "caregiver";

interface PopulationConfig {
  id: PopulationType;
  label: string;
  description: string;
  icon: typeof User;
  color: string;
  features: string[];
  uiAdjustments: {
    largeText: boolean;
    highContrast: boolean;
    simplifiedNav: boolean;
    voiceEnabled: boolean;
    reducedMotion: boolean;
  };
}

const POPULATION_CONFIGS: Record<PopulationType, PopulationConfig> = {
  general: {
    id: "general",
    label: "Standard",
    description: "Default experience for all users",
    icon: User,
    color: "text-blue-500",
    features: ["Full navigation", "Standard text size", "All features available"],
    uiAdjustments: {
      largeText: false,
      highContrast: false,
      simplifiedNav: false,
      voiceEnabled: false,
      reducedMotion: false,
    },
  },
  geriatric: {
    id: "geriatric",
    label: "Senior-Friendly",
    description: "Optimized for older adults with larger text and simplified navigation",
    icon: Heart,
    color: "text-rose-500",
    features: [
      "Extra large text",
      "Simplified navigation",
      "Medication-first design",
      "One-tap emergency contacts",
      "Voice navigation",
    ],
    uiAdjustments: {
      largeText: true,
      highContrast: true,
      simplifiedNav: true,
      voiceEnabled: true,
      reducedMotion: true,
    },
  },
  pediatric: {
    id: "pediatric",
    label: "Pediatric Care",
    description: "Parent/guardian-friendly interface for managing children's health",
    icon: Baby,
    color: "text-cyan-500",
    features: [
      "Growth charts",
      "Immunization tracking",
      "Milestone monitoring",
      "Parent-friendly navigation",
      "Age-appropriate content",
    ],
    uiAdjustments: {
      largeText: false,
      highContrast: false,
      simplifiedNav: false,
      voiceEnabled: false,
      reducedMotion: false,
    },
  },
  cancer: {
    id: "cancer",
    label: "Oncology Care",
    description: "Specialized tools for cancer patients and survivors",
    icon: Ribbon,
    color: "text-purple-500",
    features: [
      "Treatment timeline",
      "Symptom tracking",
      "Survivorship care plan",
      "Side effects journal",
      "Care team coordination",
    ],
    uiAdjustments: {
      largeText: false,
      highContrast: false,
      simplifiedNav: false,
      voiceEnabled: false,
      reducedMotion: false,
    },
  },
  special_needs: {
    id: "special_needs",
    label: "Accessibility Mode",
    description: "Enhanced accessibility for visual, hearing, or motor impairments",
    icon: Accessibility,
    color: "text-green-500",
    features: [
      "Full voice navigation",
      "Screen reader optimized",
      "High contrast mode",
      "Keyboard navigation",
      "Simplified interface",
    ],
    uiAdjustments: {
      largeText: true,
      highContrast: true,
      simplifiedNav: true,
      voiceEnabled: true,
      reducedMotion: true,
    },
  },
  caregiver: {
    id: "caregiver",
    label: "Caregiver Mode",
    description: "Tools for caregivers managing a loved one's health",
    icon: Users,
    color: "text-amber-500",
    features: [
      "Multi-profile management",
      "Care coordination",
      "Medication reminders",
      "Appointment scheduling",
      "Care notes",
    ],
    uiAdjustments: {
      largeText: false,
      highContrast: false,
      simplifiedNav: false,
      voiceEnabled: false,
      reducedMotion: false,
    },
  },
};

interface PopulationContextValue {
  populationType: PopulationType;
  setPopulationType: (type: PopulationType) => void;
  config: PopulationConfig;
  isSimplifiedMode: boolean;
}

const PopulationContext = createContext<PopulationContextValue | null>(null);

export function usePopulation() {
  const context = useContext(PopulationContext);
  if (!context) {
    throw new Error("usePopulation must be used within a PopulationDashboardWrapper");
  }
  return context;
}

interface PopulationDashboardWrapperProps {
  children: React.ReactNode;
  userId?: string;
  className?: string;
}

export function PopulationDashboardWrapper({
  children,
  userId = "current-user",
  className,
}: PopulationDashboardWrapperProps) {
  const [populationType, setPopulationType] = useState<PopulationType>(() => {
    const saved = localStorage.getItem("tabula-population-type");
    return (saved as PopulationType) || "general";
  });

  const { settings: accessibilitySettings, updateSetting } = useAccessibility();
  const config = POPULATION_CONFIGS[populationType];

  const prevPopulationType = useRef(populationType);

  useEffect(() => {
    localStorage.setItem("tabula-population-type", populationType);

    if (prevPopulationType.current !== populationType) {
      if (config.uiAdjustments.largeText) {
        updateSetting("largeText", true);
      }
      if (config.uiAdjustments.highContrast) {
        updateSetting("highContrast", true);
      }
      if (config.uiAdjustments.reducedMotion) {
        updateSetting("reducedMotion", true);
      }
      if (config.uiAdjustments.voiceEnabled) {
        updateSetting("voiceNavigation", true);
      }
      prevPopulationType.current = populationType;
    }
  }, [populationType, config, updateSetting]);

  const contextValue: PopulationContextValue = {
    populationType,
    setPopulationType,
    config,
    isSimplifiedMode: config.uiAdjustments.simplifiedNav,
  };

  return (
    <PopulationContext.Provider value={contextValue}>
      <div className={cn("relative", className)}>
        {children}
        {config.uiAdjustments.voiceEnabled && (
          <VoiceNavigationControl userId={userId} />
        )}
      </div>
    </PopulationContext.Provider>
  );
}

interface PopulationSelectorProps {
  className?: string;
  showFeatures?: boolean;
}

export function PopulationSelector({
  className,
  showFeatures = true,
}: PopulationSelectorProps) {
  const { populationType, setPopulationType, config } = usePopulation();

  return (
    <Card className={cn("w-full", className)} data-testid="card-population-selector">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <config.icon className={cn("h-5 w-5", config.color)} />
          Experience Mode
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={populationType} onValueChange={(value) => setPopulationType(value as PopulationType)}>
          <SelectTrigger className="w-full" data-testid="select-population-type">
            <SelectValue placeholder="Select experience mode" />
          </SelectTrigger>
          <SelectContent>
            {Object.values(POPULATION_CONFIGS).map((pop) => {
              const Icon = pop.icon;
              return (
                <SelectItem key={pop.id} value={pop.id}>
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", pop.color)} />
                    <span>{pop.label}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        <p className="text-sm text-muted-foreground">{config.description}</p>

        {showFeatures && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">Features:</p>
            <div className="flex flex-wrap gap-1">
              {config.features.map((feature, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {feature}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {config.uiAdjustments.voiceEnabled && (
          <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-md">
            <Volume2 className="h-4 w-4 text-primary" />
            <span className="text-sm">Voice navigation is enabled</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface QuickAccessPanelProps {
  className?: string;
}

export function QuickAccessPanel({ className }: QuickAccessPanelProps) {
  const { populationType, config, isSimplifiedMode } = usePopulation();
  const { settings: accessibilitySettings } = useAccessibility();

  const quickActions = {
    general: [
      { label: "My Health", href: "/dashboard", icon: Heart },
      { label: "Medications", href: "/medications", icon: Heart },
      { label: "Messages", href: "/messages", icon: Heart },
    ],
    geriatric: [
      { label: "My Medications", href: "/geriatric-home", icon: Heart },
      { label: "Call Doctor", href: "/messages", icon: Heart },
      { label: "Emergency Contacts", href: "/caregivers", icon: Heart },
      { label: "Appointments", href: "/timeline", icon: Heart },
    ],
    pediatric: [
      { label: "Growth Chart", href: "/pediatric", icon: Baby },
      { label: "Immunizations", href: "/pediatric", icon: Baby },
      { label: "Milestones", href: "/pediatric", icon: Baby },
    ],
    cancer: [
      { label: "Treatment Timeline", href: "/cancer-track", icon: Ribbon },
      { label: "Side Effects", href: "/side-effects-journal", icon: Ribbon },
      { label: "Care Plan", href: "/survivorship", icon: Ribbon },
    ],
    special_needs: [
      { label: "Voice Commands", href: "/accessibility", icon: Volume2 },
      { label: "Settings", href: "/accessibility", icon: Accessibility },
      { label: "Help", href: "/learn", icon: Eye },
    ],
    caregiver: [
      { label: "Care Dashboard", href: "/caregiver-hub", icon: Users },
      { label: "Manage Access", href: "/caregiver-management", icon: Users },
      { label: "Care Notes", href: "/caregiver-hub", icon: Users },
    ],
  };

  const actions = quickActions[populationType] || quickActions.general;

  if (!isSimplifiedMode && populationType === "general") {
    return null;
  }

  return (
    <Card className={cn("w-full", className)} data-testid="card-quick-access">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn(
          "grid gap-2",
          isSimplifiedMode ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3"
        )}>
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Button
                key={index}
                variant="outline"
                className={cn(
                  "h-auto py-4 flex-col gap-2 hover-elevate",
                  isSimplifiedMode && "text-lg py-6"
                )}
                asChild
                data-testid={`button-quick-${action.label.toLowerCase().replace(/\s/g, "-")}`}
              >
                <a href={action.href}>
                  <Icon className={cn("h-6 w-6", config.color)} />
                  <span>{action.label}</span>
                </a>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function PopulationBanner() {
  const { populationType, config } = usePopulation();

  if (populationType === "general") {
    return null;
  }

  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg mb-4",
        "bg-primary/5 border border-primary/20"
      )}
      role="status"
      aria-live="polite"
      data-testid="banner-population-mode"
    >
      <Icon className={cn("h-5 w-5", config.color)} />
      <span className="text-sm font-medium">
        {config.label} Mode Active
      </span>
      <span className="text-sm text-muted-foreground hidden sm:inline">
        - {config.description}
      </span>
    </div>
  );
}

export default PopulationDashboardWrapper;
