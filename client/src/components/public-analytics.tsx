import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { analyticsPageUrl, mayLoadThirdPartyAnalytics } from "@shared/privacy/analytics-allowlist";

const SCRIPT_ID = "tm-plausible";
const SCRIPT_SRC = "https://plausible.io/js/script.manual.js";

type PlausibleFn = ((event: string, options?: { u?: string; url?: string }) => void) & {
  q?: unknown[][];
};

function disarmPlausible(): void {
  document.getElementById(SCRIPT_ID)?.remove();
  const w = window as Window & { plausible?: PlausibleFn };
  w.plausible = () => {};
}

/**
 * Loads cookieless analytics only after auth has resolved and only on the
 * marketing allowlist. The manual script does not track history changes, and
 * the page URL we send has no query string. Health and account routes never
 * insert the script, so the browser does not contact the vendor.
 */
export function PublicAnalytics() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  useEffect(() => {
    if (typeof window === "undefined" || isLoading) return;
    const allowed = mayLoadThirdPartyAnalytics({
      pathname: location,
      authenticated: Boolean(user),
      hostname: window.location.hostname,
    });
    if (!allowed) {
      disarmPlausible();
      return;
    }
    const pageUrl = analyticsPageUrl(window.location.origin, location);
    const w = window as Window & { plausible?: PlausibleFn };
    if (!w.plausible) {
      const queue: PlausibleFn = ((event: string, options?: { u?: string; url?: string }) => {
        queue.q = queue.q || [];
        queue.q.push([event, options]);
      }) as PlausibleFn;
      w.plausible = queue;
    }
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const send = () => w.plausible?.("pageview", { u: pageUrl, url: pageUrl });
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.defer = true;
      script.dataset.domain = "tabulamedica.health";
      script.src = SCRIPT_SRC;
      script.addEventListener("load", send, { once: true });
      document.head.appendChild(script);
      return;
    }
    send();
  }, [isLoading, user, location]);

  return null;
}
