import { useState } from "react";
import { Shield, Lock, Eye, EyeOff, ChevronDown, ChevronUp, Server, Fingerprint } from "lucide-react";
import { cn } from "@/lib/utils";

interface ZeroKnowledgeBadgeProps {
  variant?: "compact" | "full" | "inline";
  className?: string;
}

export function ZeroKnowledgeBadge({ variant = "compact", className }: ZeroKnowledgeBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  if (variant === "inline") {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400", className)} data-testid="badge-zero-knowledge-inline">
        <Shield className="h-3 w-3" />
        Zero-Knowledge Encrypted
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-full",
          "bg-emerald-500/10 border border-emerald-500/20",
          "text-emerald-700 dark:text-emerald-300",
          className
        )}
        data-testid="badge-zero-knowledge"
      >
        <div className="relative">
          <Shield className="h-4 w-4" />
          <Lock className="h-2 w-2 absolute -bottom-0.5 -right-0.5" />
        </div>
        <span className="text-xs font-semibold tracking-wide">Zero-Knowledge</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden transition-all",
        "bg-gradient-to-br from-emerald-500/5 to-teal-500/5",
        "border-emerald-500/20 dark:border-emerald-500/15",
        className
      )}
      data-testid="badge-zero-knowledge-full"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-emerald-500/5 transition-colors"
        data-testid="button-zkp-expand"
      >
        <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
          <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Zero-Knowledge Encryption</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">VERIFIED</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Even we can't read your health records</p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-emerald-500/10 pt-3" data-testid="zkp-details">
          <div className="grid gap-2.5">
            {[
              {
                icon: Lock,
                title: "Edge Encryption",
                desc: "Your data is encrypted on your device before it ever leaves. The encryption key never touches our servers.",
              },
              {
                icon: EyeOff,
                title: "We Can't See Your Data",
                desc: "Our servers store only encrypted blobs. Without your key, your records are mathematically impossible to read.",
              },
              {
                icon: Server,
                title: "AES-256-GCM + TLS 1.3",
                desc: "Military-grade encryption at rest (AES-256-GCM) and in transit (TLS 1.3 with HSTS). Same standards used by the DoD.",
              },
              {
                icon: Fingerprint,
                title: "You Hold the Key",
                desc: "Your biometric or passkey unlocks your encryption key locally. If you delete your account, the data is permanently irrecoverable.",
              },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-2.5">
                <div className="h-7 w-7 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <item.icon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4 pt-1 border-t border-emerald-500/10">
            {["HIPAA", "SOC 2 Type II", "FIPS 140-3"].map((cert) => (
              <span key={cert} className="text-[10px] font-semibold text-emerald-700/60 dark:text-emerald-300/60 tracking-wide">
                {cert}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function PrivacyFirstIndicator({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-4 flex-wrap", className)} data-testid="privacy-first-indicators">
      {[
        { icon: Eye, label: "We never sell your data", highlight: false },
        { icon: Lock, label: "Zero-knowledge encryption", highlight: true },
        { icon: Shield, label: "HIPAA compliant", highlight: false },
        { icon: Fingerprint, label: "You own your keys", highlight: false },
      ].map((item) => (
        <span
          key={item.label}
          className={cn(
            "inline-flex items-center gap-1.5 text-xs",
            item.highlight ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
          )}
        >
          <item.icon className="h-3 w-3" />
          {item.label}
        </span>
      ))}
    </div>
  );
}
