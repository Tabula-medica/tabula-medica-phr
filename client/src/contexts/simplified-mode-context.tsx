import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAccessibility } from "@/components/accessibility-provider";

interface SimplifiedModeContextType {
  isSimplifiedMode: boolean;
  setSimplifiedMode: (enabled: boolean) => void;
  toggleSimplifiedMode: () => void;
}

const SimplifiedModeContext = createContext<SimplifiedModeContextType | null>(null);

export function SimplifiedModeProvider({ children }: { children: ReactNode }) {
  const { settings, updateSetting } = useAccessibility();
  const [isSimplifiedMode, setIsSimplifiedMode] = useState(settings.simplifiedView);

  useEffect(() => {
    setIsSimplifiedMode(settings.simplifiedView);
  }, [settings.simplifiedView]);

  useEffect(() => {
    if (isSimplifiedMode) {
      document.documentElement.classList.add("simplified-mode");
    } else {
      document.documentElement.classList.remove("simplified-mode");
    }
  }, [isSimplifiedMode]);

  const setSimplifiedMode = (enabled: boolean) => {
    setIsSimplifiedMode(enabled);
    updateSetting("simplifiedView", enabled);
  };

  const toggleSimplifiedMode = () => {
    setSimplifiedMode(!isSimplifiedMode);
  };

  return (
    <SimplifiedModeContext.Provider
      value={{
        isSimplifiedMode,
        setSimplifiedMode,
        toggleSimplifiedMode,
      }}
    >
      {children}
    </SimplifiedModeContext.Provider>
  );
}

export function useSimplifiedMode() {
  const context = useContext(SimplifiedModeContext);
  if (!context) {
    throw new Error("useSimplifiedMode must be used within a SimplifiedModeProvider");
  }
  return context;
}
