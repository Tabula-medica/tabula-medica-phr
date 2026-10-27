import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAutoRead } from "@/hooks/use-auto-read";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts-help";
import { useAnnounce } from "@/components/screen-reader-announcer";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard - Tabula Medica",
  "/timeline": "Health Timeline - Tabula Medica",
  "/medications": "Medications - Tabula Medica",
  "/documents": "Documents - Tabula Medica",
  "/connections": "Connections - Tabula Medica",
  "/accessibility": "Accessibility Settings - Tabula Medica",
  "/settings": "Settings - Tabula Medica",
  "/identity": "Identity Verification - Tabula Medica",
  "/appointments": "Appointments - Tabula Medica",
  "/lab-results": "Lab Results - Tabula Medica",
  "/vitals": "Vitals - Tabula Medica",
  "/allergies": "Allergies - Tabula Medica",
  "/immunizations": "Immunizations - Tabula Medica",
  "/care-team": "Care Team - Tabula Medica",
  "/messaging": "Secure Messaging - Tabula Medica",
  "/health-records": "Health Records - Tabula Medica",
  "/ai-advisor": "AI Health Advisor - Tabula Medica",
  "/conditions": "Conditions - Tabula Medica",
  "/security": "Security - Tabula Medica",
  "/privacy": "Privacy Settings - Tabula Medica",
  "/caregivers": "Caregivers - Tabula Medica",
  "/profiles": "Profiles - Tabula Medica",
  "/health-analytics": "Health Analytics - Tabula Medica",
  "/health-goals": "Health Goals - Tabula Medica",
  "/health-journal": "Health Journal - Tabula Medica",
  "/medication-adherence": "Medication Adherence - Tabula Medica",
  "/appointment-reminders": "Appointment Reminders - Tabula Medica",
  "/chronic-disease": "Chronic Disease Management - Tabula Medica",
  "/sleep-tracking": "Sleep Tracking - Tabula Medica",
  "/nutrition-tracking": "Nutrition Tracking - Tabula Medica",
  "/exercise-tracking": "Exercise Tracking - Tabula Medica",
  "/wearable-insights": "Wearable Insights - Tabula Medica",
  "/voice-access": "Voice Access - Tabula Medica",
  "/rewards": "Rewards - Tabula Medica",
  "/learn": "Health Education - Tabula Medica",
  "/research": "Research - Tabula Medica",
  "/share-links": "Share Links - Tabula Medica",
  "/onboarding": "Onboarding - Tabula Medica",
  "/ai-evidence-advisor": "AI Evidence Advisor - Tabula Medica",
  "/patient-dashboard": "Patient Dashboard - Tabula Medica",
};

export function A11yEnhancements() {
  const [location] = useLocation();
  const { announce } = useAnnounce();
  const { shortcuts, showHelp, closeHelp } = useKeyboardShortcuts();

  useAutoRead();

  useEffect(() => {
    const title = PAGE_TITLES[location] || "Tabula Medica";
    document.title = title;

    const pageName = title.replace(" - Tabula Medica", "");
    announce(`Page: ${pageName}`);
  }, [location, announce]);

  useEffect(() => {
    const main = document.getElementById("main-content");
    if (main && !main.hasAttribute("tabindex")) {
      main.setAttribute("tabindex", "-1");
      main.style.outline = "none";
    }
  }, []);

  return (
    <>
      {showHelp && (
        <KeyboardShortcutsHelp shortcuts={shortcuts} onClose={closeHelp} />
      )}
    </>
  );
}
