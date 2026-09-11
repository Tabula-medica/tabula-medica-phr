import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * PasswordInput — a password field with an accessible show/hide toggle.
 *
 * People frequently mistype passwords and get "stuck" at login with no way to
 * verify what they typed. This adds a reveal button (eye icon) that toggles the
 * field between masked and plaintext, without breaking password-manager
 * autofill (the underlying input keeps its name/autoComplete/type semantics —
 * we only flip type on demand).
 *
 * Drop-in replacement for <Input type="password" .../>. All Input props pass
 * through; `type` is managed internally.
 */
const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "type">
>(({ className, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Input
        ref={ref}
        type={visible ? "text" : "password"}
        className={cn("pr-10", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        // Keep out of the tab order between email→password→submit; the field
        // itself is focusable and reveal is a mouse/opt-in affordance.
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        title={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        data-testid="button-toggle-password"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
