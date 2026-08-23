import { useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Keyboard } from "lucide-react";

interface ShortcutItem {
  key: string;
  alt?: boolean;
  shift?: boolean;
  description: string;
  category: string;
}

export function KeyboardShortcutsHelp({
  shortcuts,
  onClose,
}: {
  shortcuts: ShortcutItem[];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }

      if (e.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const grouped = shortcuts.reduce<Record<string, ShortcutItem[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  function formatKey(s: ShortcutItem) {
    const parts: string[] = [];
    if (s.alt) parts.push("Alt");
    if (s.shift) parts.push("Shift");
    parts.push(s.key === "/" ? "/" : s.key.toUpperCase());
    return parts.join(" + ");
  }

  return (
    // The scrim is decoration: no dialog semantics, no tab stop.
    // Click-to-dismiss is a mouse shortcut for the close button; the keyboard
    // routes out are Escape and that button.
    <div
      className="fixed inset-0 z-[200] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="presentation"
      onClick={onClose}
    >
      <Card
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        data-testid="dialog-keyboard-shortcuts"
        className="w-full max-w-lg animate-in zoom-in-95 max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="text-lg font-semibold" id="shortcuts-title">
                Keyboard Shortcuts
              </h2>
            </div>
            <Button
              ref={closeRef}
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close keyboard shortcuts dialog"
              data-testid="button-close-shortcuts"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Use these keyboard shortcuts to navigate the app without a mouse. 
            All shortcuts use the Alt key combined with a letter.
          </p>

          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="mb-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                {category}
              </h3>
              <div className="space-y-2">
                {items.map((s) => (
                  <div
                    key={s.key + (s.alt ? "alt" : "") + (s.shift ? "shift" : "")}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm">{s.description}</span>
                    <Badge
                      variant="outline"
                      className="font-mono text-xs"
                      aria-label={`Shortcut: ${formatKey(s)}`}
                    >
                      {formatKey(s)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Press <Badge variant="outline" className="font-mono text-xs mx-1">Escape</Badge> 
              to close this dialog. Shortcuts are disabled when typing in form fields.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
