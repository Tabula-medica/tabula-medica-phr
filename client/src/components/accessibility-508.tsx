import { useEffect } from "react";

export function SkipNavLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
      data-testid="skip-nav-link"
    >
      Skip to main content
    </a>
  );
}

export function SkipNavTarget() {
  return <div id="main-content" tabIndex={-1} className="outline-none" />;
}

export function LiveRegion({ message, politeness = "polite" }: { message: string; politeness?: "polite" | "assertive" }) {
  return (
    <div
      aria-live={politeness}
      aria-atomic="true"
      role="status"
      className="sr-only"
      data-testid="live-region"
    >
      {message}
    </div>
  );
}

export function useFocusManagement() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        document.body.classList.add("keyboard-navigation");
      }
    };

    const handleMouseDown = () => {
      document.body.classList.remove("keyboard-navigation");
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleMouseDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleMouseDown);
    };
  }, []);
}

export function A11yMetadata() {
  useEffect(() => {
    document.documentElement.lang = "en";
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) {
      const content = meta.getAttribute("content") || "";
      if (!content.includes("maximum-scale")) {
        meta.setAttribute("content", content + ", maximum-scale=5");
      }
    }
  }, []);

  return null;
}
