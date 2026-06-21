import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAccessibility } from "@/components/accessibility-provider";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard. Your health overview and quick actions.",
  "/timeline": "Health Timeline. Your medical events in chronological order.",
  "/medications": "Medications. Your current prescriptions and medication history.",
  "/documents": "Documents. Your medical records and uploaded files.",
  "/connections": "Connections. Manage your health system connections.",
  "/accessibility": "Accessibility Settings. Customize your experience for your needs.",
  "/settings": "Settings. Manage your account and preferences.",
  "/identity": "Identity Verification. Verify and manage your identity.",
  "/appointments": "Appointments. Your upcoming and past medical appointments.",
  "/lab-results": "Lab Results. Your laboratory test results.",
  "/vitals": "Vitals. Your vital signs and measurements.",
  "/allergies": "Allergies. Your recorded allergies and sensitivities.",
  "/immunizations": "Immunizations. Your vaccination records.",
  "/care-team": "Care Team. Your healthcare providers and care coordinators.",
  "/messaging": "Secure Messaging. Communicate securely with your care team.",
  "/health-records": "Health Records. Your comprehensive health data.",
  "/ai-advisor": "AI Health Advisor. Evidence-based health guidance.",
  "/conditions": "Conditions. Your medical conditions and diagnoses.",
  "/security": "Security. Manage your account security settings.",
  "/privacy": "Privacy. Manage your privacy preferences.",
  "/caregivers": "Caregivers. Manage your caregiver access and permissions.",
  "/profiles": "Profiles. Manage family and dependent profiles.",
  "/health-analytics": "Health Analytics. View trends and insights from your health data.",
  "/health-goals": "Health Goals. Set and track your personal health objectives.",
  "/health-journal": "Health Journal. Record daily health observations.",
  "/medication-adherence": "Medication Adherence. Track how well you follow your prescriptions.",
  "/appointment-reminders": "Appointment Reminders. View and manage your appointment alerts.",
  "/chronic-disease": "Chronic Disease Management. Tools for managing ongoing health conditions.",
  "/sleep-tracking": "Sleep Tracking. Monitor your sleep patterns and quality.",
  "/nutrition-tracking": "Nutrition Tracking. Log meals and track nutritional intake.",
  "/exercise-tracking": "Exercise Tracking. Monitor your physical activity and fitness.",
  "/wearable-insights": "Wearable Insights. Data from your connected health devices.",
  "/voice-access": "Voice Access. Navigate the app using voice commands.",
  "/rewards": "Rewards. View your health engagement achievements.",
  "/learn": "Health Education. Learn about health topics and wellness.",
  "/research": "Research. Participate in health research studies.",
};

export function useAutoRead() {
  const [location] = useLocation();
  const { settings } = useAccessibility();
  const lastReadLocation = useRef("");
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!settings.autoReadAloud) return;
    if (location === lastReadLocation.current) return;
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    lastReadLocation.current = location;

    window.speechSynthesis.cancel();

    const pageTitle = PAGE_TITLES[location] || document.title?.replace(" - Tabula Medica", "");
    if (!pageTitle) return;

    const delay = setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(pageTitle);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      synthRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }, 500);

    return () => {
      clearTimeout(delay);
      window.speechSynthesis.cancel();
    };
  }, [location, settings.autoReadAloud]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);
}
