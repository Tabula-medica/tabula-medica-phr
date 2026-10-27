import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { AccessibilityInfo, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ACCESSIBILITY_STORAGE_KEY = "@tabula_medica_accessibility";

export type ViewMode = "standard" | "simplified" | "caregiver" | "cancer_track";
export type FontSizeLevel = "small" | "normal" | "large" | "extraLarge";

interface AccessibilitySettings {
  viewMode: ViewMode;
  largeText: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  simplifiedMode: boolean;
  fontSizeLevel: FontSizeLevel;
  readAloudEnabled: boolean;
}

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => Promise<void>;
  toggleSimplifiedMode: () => Promise<void>;
  toggleLargeText: () => Promise<void>;
  toggleHighContrast: () => Promise<void>;
  toggleReducedMotion: () => Promise<void>;
  toggleReadAloud: () => Promise<void>;
  setFontSizeLevel: (level: FontSizeLevel) => Promise<void>;
  updateSetting: (key: keyof AccessibilitySettings, value: boolean | ViewMode | FontSizeLevel) => Promise<void>;
  isSimplified: boolean;
  isCaregiver: boolean;
  isCancerTrack: boolean;
  fontScale: number;
  screenReaderEnabled: boolean;
}

export const FONT_SIZE_SCALES: Record<FontSizeLevel, number> = {
  small: 0.85,
  normal: 1.0,
  large: 1.3,
  extraLarge: 1.6,
};

export const FONT_SIZE_LABELS: Record<FontSizeLevel, string> = {
  small: "Small",
  normal: "Normal",
  large: "Large",
  extraLarge: "Extra Large",
};

const defaultSettings: AccessibilitySettings = {
  viewMode: "standard",
  simplifiedMode: false,
  largeText: false,
  highContrast: false,
  reducedMotion: false,
  fontSizeLevel: "normal",
  readAloudEnabled: false,
};

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AccessibilitySettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);

  useEffect(() => {
    loadSettings();
    if (Platform.OS !== "web") {
      AccessibilityInfo.isScreenReaderEnabled().then(setScreenReaderEnabled);
      const subscription = AccessibilityInfo.addEventListener(
        "screenReaderChanged",
        setScreenReaderEnabled,
      );
      return () => subscription.remove();
    }
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(ACCESSIBILITY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (error) {
      console.error("Error loading accessibility settings:", error);
    } finally {
      setIsLoaded(true);
    }
  };

  const saveSettings = async (newSettings: AccessibilitySettings) => {
    try {
      await AsyncStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.error("Error saving accessibility settings:", error);
    }
  };

  const updateSetting = async (key: keyof AccessibilitySettings, value: boolean | ViewMode | FontSizeLevel) => {
    const newSettings = { ...settings, [key]: value };
    if (key === "fontSizeLevel") {
      newSettings.largeText = value === "large" || value === "extraLarge";
    }
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const setViewMode = async (mode: ViewMode) => {
    const newSettings = { 
      ...settings, 
      viewMode: mode,
      simplifiedMode: mode === "simplified",
    };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const toggleSimplifiedMode = async () => {
    if (settings.simplifiedMode) {
      await setViewMode("standard");
    } else {
      await setViewMode("simplified");
    }
  };

  const toggleLargeText = async () => {
    const newLargeText = !settings.largeText;
    const newSettings = {
      ...settings,
      largeText: newLargeText,
      fontSizeLevel: newLargeText ? "large" as FontSizeLevel : "normal" as FontSizeLevel,
    };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const toggleHighContrast = async () => {
    await updateSetting("highContrast", !settings.highContrast);
  };

  const toggleReducedMotion = async () => {
    await updateSetting("reducedMotion", !settings.reducedMotion);
  };

  const toggleReadAloud = async () => {
    await updateSetting("readAloudEnabled", !settings.readAloudEnabled);
  };

  const setFontSizeLevel = async (level: FontSizeLevel) => {
    await updateSetting("fontSizeLevel", level);
  };

  const isSimplified = settings.viewMode === "simplified" || settings.simplifiedMode;
  const isCaregiver = settings.viewMode === "caregiver";
  const isCancerTrack = settings.viewMode === "cancer_track";
  const fontScale = FONT_SIZE_SCALES[settings.fontSizeLevel] || 1.0;

  if (!isLoaded) {
    return null;
  }

  return (
    <AccessibilityContext.Provider
      value={{
        settings,
        viewMode: settings.viewMode,
        setViewMode,
        toggleSimplifiedMode,
        toggleLargeText,
        toggleHighContrast,
        toggleReducedMotion,
        toggleReadAloud,
        setFontSizeLevel,
        updateSetting,
        isSimplified,
        isCaregiver,
        isCancerTrack,
        fontScale,
        screenReaderEnabled,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error("useAccessibility must be used within an AccessibilityProvider");
  }
  return context;
}

export const getAccessibilityFontScale = (settings: AccessibilitySettings) => {
  return FONT_SIZE_SCALES[settings.fontSizeLevel] || 1.0;
};

export const getAccessibilitySpacingScale = (settings: AccessibilitySettings) => {
  if (settings.viewMode === "simplified" || settings.simplifiedMode) {
    return 1.3;
  }
  if (settings.viewMode === "caregiver") {
    return 1.2;
  }
  return 1;
};

export const VIEW_MODE_INFO: Record<ViewMode, {
  label: string;
  description: string;
  icon: string;
}> = {
  standard: {
    label: "Standard",
    description: "Full feature access with complete details",
    icon: "layout",
  },
  simplified: {
    label: "Simplified",
    description: "Larger text, fewer options, focus on today",
    icon: "maximize-2",
  },
  caregiver: {
    label: "Caregiver",
    description: "Task checklist, medications, emergency share QR",
    icon: "heart",
  },
  cancer_track: {
    label: "Cancer Track",
    description: "Extended timeline, side effects, 10+ year follow-ups",
    icon: "calendar",
  },
};
