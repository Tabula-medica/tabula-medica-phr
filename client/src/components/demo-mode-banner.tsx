import { Info } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { DEMO_USER_ID } from "@shared/demo-account";

// Persistent (non-dismissible) banner shown only to the shared "Try Demo"
// account — see POST /api/auth/demo-session. Not a one-time disclaimer like
// GuardrailsDisclaimer: the demo-ness of the session doesn't go away, so
// hiding it would be misleading.
export function DemoModeBanner() {
  const { user } = useAuth();
  if (user?.id !== DEMO_USER_ID) return null;

  return (
    <div
      className="w-full bg-sky-50/80 dark:bg-sky-950/20 border-b border-sky-200/50 dark:border-sky-800/50 px-4 py-2"
      data-testid="banner-demo-mode"
      role="status"
      aria-label="Demo mode"
    >
      <div className="container max-w-7xl mx-auto flex items-center gap-3 text-xs text-sky-700 dark:text-sky-300">
        <Info className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <span className="flex-1">
          You're viewing a shared, read-only demo account with sample data. Changes can't be saved here.
        </span>
        <a href="/auth/register" className="flex-shrink-0 font-medium underline hover:no-underline" data-testid="link-demo-signup">
          Sign up for your own free account
        </a>
      </div>
    </div>
  );
}
