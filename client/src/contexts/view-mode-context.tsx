import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type ViewMode = "standard" | "simplified" | "caregiver" | "cancer_track";

interface ViewModeConfig {
  mode: ViewMode;
  label: string;
  description: string;
  features: string[];
}

export const viewModeConfigs: Record<ViewMode, ViewModeConfig> = {
  standard: {
    mode: "standard",
    label: "Standard View",
    description: "Full-featured health record management",
    features: ["All features enabled", "Complete navigation", "Full detail views"],
  },
  simplified: {
    mode: "simplified",
    label: "Simplified Mode",
    description: "Big type, fewer options, 'Today' focus",
    features: ["Large text and buttons", "Today's priorities", "Essential actions only", "High contrast"],
  },
  caregiver: {
    mode: "caregiver",
    label: "Caregiver Mode",
    description: "Task-focused view for caregivers",
    features: ["Task checklist", "Medication management", "Emergency share QR", "Quick actions"],
  },
  cancer_track: {
    mode: "cancer_track",
    label: "Cancer Track Mode",
    description: "Long-term timeline for oncology care",
    features: ["10+ year timeline", "Treatment history", "Side effects tracking", "Follow-up schedule"],
  },
};

interface ViewModeContextType {
  currentMode: ViewMode;
  setMode: (mode: ViewMode) => void;
  isSimplified: boolean;
  isCaregiver: boolean;
  isCancerTrack: boolean;
  config: ViewModeConfig;
}

const ViewModeContext = createContext<ViewModeContextType | null>(null);

const VIEW_MODE_STORAGE_KEY = "tabula-medica-view-mode";

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [currentMode, setCurrentMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (saved && saved in viewModeConfigs) {
        return saved as ViewMode;
      }
    }
    return "standard";
  });

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, currentMode);

    const root = document.documentElement;
    root.classList.remove("view-mode-simplified", "view-mode-caregiver", "view-mode-cancer-track");

    if (currentMode === "simplified") {
      root.classList.add("view-mode-simplified", "simplified-mode");
    } else {
      root.classList.remove("simplified-mode");
    }

    if (currentMode === "caregiver") {
      root.classList.add("view-mode-caregiver");
    }

    if (currentMode === "cancer_track") {
      root.classList.add("view-mode-cancer-track");
    }
  }, [currentMode]);

  const setMode = (mode: ViewMode) => {
    setCurrentMode(mode);
  };

  return (
    <ViewModeContext.Provider
      value={{
        currentMode,
        setMode,
        isSimplified: currentMode === "simplified",
        isCaregiver: currentMode === "caregiver",
        isCancerTrack: currentMode === "cancer_track",
        config: viewModeConfigs[currentMode],
      }}
    >
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error("useViewMode must be used within a ViewModeProvider");
  }
  return context;
}
