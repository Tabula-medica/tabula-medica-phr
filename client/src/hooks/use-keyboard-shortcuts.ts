import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useAnnounce } from "@/components/screen-reader-announcer";

interface ShortcutDef {
  key: string;
  alt?: boolean;
  shift?: boolean;
  description: string;
  category: string;
  action: () => void;
}

export function useKeyboardShortcuts() {
  const [, setLocation] = useLocation();
  const { announce } = useAnnounce();
  const [showHelp, setShowHelp] = useState(false);

  const toggleHelp = useCallback(() => {
    setShowHelp(prev => !prev);
  }, []);

  const closeHelp = useCallback(() => {
    setShowHelp(false);
  }, []);

  const shortcuts: ShortcutDef[] = [
    {
      key: "/",
      alt: true,
      description: "Show keyboard shortcuts",
      category: "General",
      action: toggleHelp,
    },
    {
      key: "v",
      alt: true,
      description: "Activate voice commands",
      category: "Accessibility",
      action: () => {
        const voiceBtn = document.querySelector('[data-testid="button-voice-command"]') as HTMLButtonElement;
        if (voiceBtn) {
          voiceBtn.click();
          announce("Voice commands activated. Speak a command.", "assertive");
        }
      },
    },
    {
      key: "h",
      alt: true,
      description: "Go to Dashboard",
      category: "Navigation",
      action: () => {
        setLocation("/");
        announce("Navigated to Dashboard");
      },
    },
    {
      key: "a",
      alt: true,
      description: "Open Accessibility settings",
      category: "Navigation",
      action: () => {
        setLocation("/accessibility");
        announce("Navigated to Accessibility Settings");
      },
    },
    {
      key: "t",
      alt: true,
      description: "Go to Timeline",
      category: "Navigation",
      action: () => {
        setLocation("/timeline");
        announce("Navigated to Timeline");
      },
    },
    {
      key: "m",
      alt: true,
      description: "Go to Medications",
      category: "Navigation",
      action: () => {
        setLocation("/medications");
        announce("Navigated to Medications");
      },
    },
    {
      key: "d",
      alt: true,
      description: "Go to Documents",
      category: "Navigation",
      action: () => {
        setLocation("/documents");
        announce("Navigated to Documents");
      },
    },
    {
      key: "s",
      alt: true,
      description: "Skip to main content",
      category: "Accessibility",
      action: () => {
        const main = document.getElementById("main-content");
        if (main) {
          main.focus();
          main.scrollIntoView({ behavior: "smooth" });
          announce("Skipped to main content");
        }
      },
    },
    {
      key: "l",
      alt: true,
      description: "Go to Lab Results",
      category: "Navigation",
      action: () => {
        setLocation("/lab-results");
        announce("Navigated to Lab Results");
      },
    },
    {
      key: "i",
      alt: true,
      description: "Go to Immunizations",
      category: "Navigation",
      action: () => {
        setLocation("/immunizations");
        announce("Navigated to Immunizations");
      },
    },
    {
      key: "c",
      alt: true,
      description: "Go to Care Team",
      category: "Navigation",
      action: () => {
        setLocation("/care-team");
        announce("Navigated to Care Team");
      },
    },
    {
      key: "p",
      alt: true,
      description: "Go to Appointments",
      category: "Navigation",
      action: () => {
        setLocation("/appointments");
        announce("Navigated to Appointments");
      },
    },
    {
      key: "r",
      alt: true,
      description: "Go to Health Records",
      category: "Navigation",
      action: () => {
        setLocation("/health-records");
        announce("Navigated to Health Records");
      },
    },
    {
      key: "e",
      alt: true,
      description: "Go to AI Health Advisor",
      category: "Navigation",
      action: () => {
        setLocation("/ai-advisor");
        announce("Navigated to AI Health Advisor");
      },
    },
  ];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      for (const shortcut of shortcuts) {
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        if (e.key.toLowerCase() === shortcut.key.toLowerCase() && altMatch && shiftMatch && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }

      if (e.key === "Escape" && showHelp) {
        e.preventDefault();
        closeHelp();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts, showHelp, closeHelp]);

  return { shortcuts, showHelp, toggleHelp, closeHelp };
}
