import { createContext, useContext, useState, useCallback, useRef } from "react";

interface AnnouncerContextType {
  announce: (message: string, priority?: "polite" | "assertive") => void;
}

const AnnouncerContext = createContext<AnnouncerContextType | undefined>(undefined);

export function ScreenReaderAnnouncer({ children }: { children: React.ReactNode }) {
  const [politeMessage, setPoliteMessage] = useState("");
  const [assertiveMessage, setAssertiveMessage] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const announce = useCallback((message: string, priority: "polite" | "assertive" = "polite") => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (priority === "assertive") {
      setAssertiveMessage("");
      requestAnimationFrame(() => setAssertiveMessage(message));
    } else {
      setPoliteMessage("");
      requestAnimationFrame(() => setPoliteMessage(message));
    }

    timeoutRef.current = setTimeout(() => {
      setPoliteMessage("");
      setAssertiveMessage("");
    }, 5000);
  }, []);

  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        role="status"
        className="sr-only"
        data-testid="screen-reader-polite"
      >
        {politeMessage}
      </div>
      <div
        aria-live="assertive"
        aria-atomic="true"
        role="alert"
        className="sr-only"
        data-testid="screen-reader-assertive"
      >
        {assertiveMessage}
      </div>
    </AnnouncerContext.Provider>
  );
}

export function useAnnounce() {
  const context = useContext(AnnouncerContext);
  if (!context) {
    return { announce: (_msg: string, _priority?: "polite" | "assertive") => {} };
  }
  return context;
}
