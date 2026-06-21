import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Check, 
  Circle, 
  ChevronRight, 
  Sparkles,
  User,
  FileText,
  Link2,
  Shield,
  Bell,
  Heart
} from "lucide-react";

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  icon: typeof Check;
  action?: () => void;
  href?: string;
  required?: boolean;
}

const CHECKLIST_STORAGE_KEY = "tabula_onboarding_checklist";

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  {
    id: "profile",
    title: "Complete your profile",
    description: "Add your basic information and preferences",
    icon: User,
    href: "/profiles",
    required: true,
  },
  {
    id: "health_records",
    title: "Import health records",
    description: "Upload documents or connect to your health portal",
    icon: FileText,
    href: "/new-user-onboarding?step=import",
    required: true,
  },
  {
    id: "ehr_connection",
    title: "Connect a health provider",
    description: "Link your patient portal via Fasten Health",
    icon: Link2,
    href: "/connect-ehr",
    required: false,
  },
  {
    id: "emergency_contact",
    title: "Add emergency contact",
    description: "Someone to contact in case of emergency",
    icon: Shield,
    href: "/profiles?tab=emergency",
    required: true,
  },
  {
    id: "notifications",
    title: "Set up notifications",
    description: "Get reminders for appointments and medications",
    icon: Bell,
    href: "/settings/notifications",
    required: false,
  },
  {
    id: "guided_tour",
    title: "Take the guided tour",
    description: "Learn how to use key features",
    icon: Sparkles,
    href: "/new-user-onboarding?step=tour",
    required: false,
  },
];

export function useOnboardingChecklist() {
  const [completedItems, setCompletedItems] = useState<string[]>(() => {
    const stored = localStorage.getItem(CHECKLIST_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });

  const markComplete = useCallback((itemId: string) => {
    setCompletedItems(prev => {
      if (prev.includes(itemId)) return prev;
      const updated = [...prev, itemId];
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const markIncomplete = useCallback((itemId: string) => {
    setCompletedItems(prev => {
      const updated = prev.filter(id => id !== itemId);
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const isComplete = useCallback((itemId: string) => {
    return completedItems.includes(itemId);
  }, [completedItems]);

  const resetChecklist = useCallback(() => {
    setCompletedItems([]);
    localStorage.removeItem(CHECKLIST_STORAGE_KEY);
  }, []);

  const progress = (completedItems.length / DEFAULT_CHECKLIST.length) * 100;
  const requiredComplete = DEFAULT_CHECKLIST
    .filter(item => item.required)
    .every(item => completedItems.includes(item.id));

  return { 
    completedItems, 
    markComplete, 
    markIncomplete, 
    isComplete, 
    resetChecklist,
    progress,
    requiredComplete,
    totalItems: DEFAULT_CHECKLIST.length,
    completedCount: completedItems.length,
  };
}

interface OnboardingChecklistProps {
  onItemClick?: (item: ChecklistItem) => void;
  showProgress?: boolean;
  compact?: boolean;
  className?: string;
}

export function OnboardingChecklist({ 
  onItemClick, 
  showProgress = true,
  compact = false,
  className = ""
}: OnboardingChecklistProps) {
  const { completedItems, markComplete, isComplete, progress, completedCount, totalItems } = useOnboardingChecklist();

  const handleItemClick = (item: ChecklistItem) => {
    if (onItemClick) {
      onItemClick(item);
    } else if (item.action) {
      item.action();
    } else if (item.href) {
      window.location.assign(item.href);
    }
  };

  if (compact) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Heart className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium">Getting Started</p>
                <p className="text-sm text-muted-foreground">
                  {completedCount} of {totalItems} completed
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Progress value={progress} className="w-24 h-2" aria-label={`${Math.round(progress)}% complete`} />
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.location.href = "/new-user-onboarding"}
                data-testid="button-continue-setup"
              >
                Continue
                <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
              Getting Started
            </CardTitle>
            <CardDescription className="mt-1">
              Complete these steps to set up your health record
            </CardDescription>
          </div>
          {showProgress && (
            <Badge variant="secondary" className="text-sm">
              {completedCount}/{totalItems}
            </Badge>
          )}
        </div>
        {showProgress && (
          <Progress 
            value={progress} 
            className="mt-3 h-2" 
            aria-label={`Setup progress: ${Math.round(progress)}% complete`}
          />
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {DEFAULT_CHECKLIST.map((item) => {
          const completed = isComplete(item.id);
          const Icon = item.icon;
          
          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              className={`w-full flex items-center gap-4 p-3 rounded-lg transition-colors text-left hover-elevate ${
                completed 
                  ? "bg-primary/5" 
                  : "hover:bg-muted/50"
              }`}
              data-testid={`checklist-item-${item.id}`}
              aria-label={`${item.title}${completed ? " - Completed" : ""}`}
            >
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                completed 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted"
              }`}>
                {completed ? (
                  <Check className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Icon className="h-5 w-5" aria-hidden="true" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`font-medium ${completed ? "line-through text-muted-foreground" : ""}`}>
                    {item.title}
                  </p>
                  {item.required && !completed && (
                    <Badge variant="outline" className="text-xs">Required</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {item.description}
                </p>
              </div>
              {!completed && (
                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function OnboardingChecklistBanner({ onDismiss }: { onDismiss?: () => void }) {
  const { progress, completedCount, totalItems, requiredComplete } = useOnboardingChecklist();
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem("tabula_checklist_dismissed") === "true";
  });

  if (dismissed || requiredComplete) return null;

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("tabula_checklist_dismissed", "true");
    onDismiss?.();
  };

  return (
    <div className="bg-primary/5 border-b px-4 py-3">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
          <span className="text-sm font-medium">
            Complete your setup: {completedCount} of {totalItems} steps done
          </span>
          <Progress value={progress} className="w-32 h-2" aria-label={`${Math.round(progress)}% complete`} />
        </div>
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            onClick={() => window.location.href = "/new-user-onboarding"}
            data-testid="button-banner-continue-setup"
          >
            Continue Setup
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={handleDismiss}
            data-testid="button-dismiss-banner"
          >
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
