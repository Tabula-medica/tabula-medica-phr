import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";

export interface AccessibilitySettings {
  largeText: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  simplifiedView: boolean;
  fontSize: "normal" | "large" | "extra-large";
  geriatricMode: boolean;
  simpleLanguage: boolean;
  oneTaskAtATime: boolean;
  screenReaderOptimized: boolean;
  keyboardNavigation: boolean;
  textFirst: boolean;
  voiceNavigation: boolean;
  dyslexiaFont: boolean;
  colorBlindMode: "none" | "protanopia" | "deuteranopia" | "tritanopia";
  cursorSize: "normal" | "large" | "extra-large";
  lineSpacing: "normal" | "relaxed" | "loose";
  readingGuide: boolean;
  autoReadAloud: boolean;
  stickyKeys: boolean;
  reducedTransparency: boolean;
}

export function isGeriatricMode(settings: AccessibilitySettings): boolean {
  return settings.geriatricMode;
}

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSetting: <K extends keyof AccessibilitySettings>(key: K, value: AccessibilitySettings[K]) => void;
  resetSettings: () => void;
}

const defaultSettings: AccessibilitySettings = {
  largeText: false,
  highContrast: false,
  reducedMotion: false,
  simplifiedView: false,
  fontSize: "normal",
  geriatricMode: false,
  simpleLanguage: false,
  oneTaskAtATime: false,
  screenReaderOptimized: false,
  keyboardNavigation: true,
  textFirst: true,
  voiceNavigation: false,
  dyslexiaFont: false,
  colorBlindMode: "none",
  cursorSize: "normal",
  lineSpacing: "normal",
  readingGuide: false,
  autoReadAloud: false,
  stickyKeys: false,
  reducedTransparency: false,
};

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("accessibility-settings");
      if (stored) {
        try {
          return { ...defaultSettings, ...JSON.parse(stored) };
        } catch {
          return defaultSettings;
        }
      }
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      return { ...defaultSettings, reducedMotion: prefersReducedMotion };
    }
    return defaultSettings;
  });

  useEffect(() => {
    const root = document.documentElement;
    
    root.classList.toggle("large-text", settings.largeText || settings.geriatricMode);
    root.classList.toggle("high-contrast", settings.highContrast || settings.geriatricMode);
    root.classList.toggle("reduced-motion", settings.reducedMotion || settings.geriatricMode);
    root.classList.toggle("simplified-view", settings.simplifiedView || settings.geriatricMode);
    root.classList.toggle("geriatric-mode", settings.geriatricMode);
    root.classList.toggle("simple-language", settings.simpleLanguage);
    root.classList.toggle("one-task-mode", settings.oneTaskAtATime);
    root.classList.toggle("screen-reader-optimized", settings.screenReaderOptimized);
    root.classList.toggle("keyboard-navigation", settings.keyboardNavigation);
    root.classList.toggle("text-first", settings.textFirst);
    root.classList.toggle("dyslexia-font", settings.dyslexiaFont);
    root.classList.toggle("reading-guide", settings.readingGuide);
    root.classList.toggle("sticky-keys", settings.stickyKeys);
    root.classList.toggle("reduced-transparency", settings.reducedTransparency);

    root.classList.remove("cb-protanopia", "cb-deuteranopia", "cb-tritanopia");
    if (settings.colorBlindMode !== "none") {
      root.classList.add(`cb-${settings.colorBlindMode}`);
    }

    root.classList.remove("cursor-normal", "cursor-large", "cursor-extra-large");
    root.classList.add(`cursor-${settings.cursorSize}`);

    root.classList.remove("line-spacing-normal", "line-spacing-relaxed", "line-spacing-loose");
    root.classList.add(`line-spacing-${settings.lineSpacing}`);
    
    root.classList.remove("font-normal", "font-large", "font-extra-large");
    if (settings.geriatricMode) {
      root.classList.add("font-extra-large");
    } else {
      root.classList.add(`font-${settings.fontSize}`);
    }

    localStorage.setItem("accessibility-settings", JSON.stringify(settings));
  }, [settings]);

  const updateSetting = useCallback(<K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
  }, []);

  return (
    <AccessibilityContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
      {settings.readingGuide && <ReadingGuide />}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error("useAccessibility must be used within an AccessibilityProvider");
  }
  return context;
}

function ReadingGuide() {
  const guideRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (guideRef.current) {
        guideRef.current.style.top = `${e.clientY - 1}px`;
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div
      ref={guideRef}
      className="fixed left-0 right-0 h-[3px] bg-primary/40 pointer-events-none z-[9999]"
      style={{ top: "50%" }}
      aria-hidden="true"
      data-testid="reading-guide-overlay"
    />
  );
}

export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
      data-testid="link-skip-to-content"
    >
      Skip to main content
    </a>
  );
}
