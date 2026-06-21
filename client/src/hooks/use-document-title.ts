import { useEffect } from "react";

/**
 * Updates the browser document title for the current page.
 *
 * WCAG 2.4.2 (Page Titled, Level A): every page must have a unique, descriptive
 * title so assistive tech announces the new context on route change.
 *
 * Usage in any page component:
 *   useDocumentTitle("Medications");
 *
 * The base "Tabula Medica" suffix is appended automatically.
 */
export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    const base = "Tabula Medica";
    const next = title && title.trim().length > 0 ? `${title} · ${base}` : base;
    if (typeof document !== "undefined" && document.title !== next) {
      document.title = next;
    }
  }, [title]);
}
