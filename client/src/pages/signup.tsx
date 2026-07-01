import { useEffect, useMemo, useRef, useState } from "react";
import { Link as WouterLink } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Loader2, Mail, ShieldCheck } from "lucide-react";
import {
  CONSENT_TEXT,
  buildSignupMailto,
  enqueueSignup,
  flushSignupQueue,
  isValidEmail,
  isValidPhone,
  trySendSignup,
  type SignupEntry,
  type SignupRole,
} from "@/lib/signup-queue";

const logoPath = "/logo.png";

type FieldErrors = Partial<Record<"fullName" | "email" | "phone", string>>;

export default function EarlyAccessSignup() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<SignupRole>("patient");
  const [organization, setOrganization] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [mailtoHref, setMailtoHref] = useState<string | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  // Retry-flush any previously queued sign-ups when this page loads.
  useEffect(() => {
    void flushSignupQueue();
  }, []);

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!fullName.trim()) next.fullName = "Please enter your full name.";
    if (!email.trim()) next.email = "Please enter your email address.";
    else if (!isValidEmail(email)) next.email = "Please enter a valid email address.";
    if (!phone.trim()) next.phone = "Please enter your phone number.";
    else if (!isValidPhone(phone))
      next.phone = "Please enter a valid phone number (at least 10 digits).";
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent || submitting) return;

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      // Move focus to the first invalid field for keyboard/AT users.
      const firstKey = Object.keys(nextErrors)[0];
      const el = document.getElementById(`signup-${firstKey}`);
      el?.focus();
      return;
    }

    setSubmitting(true);

    // Step 1: persist locally FIRST so the lead is never lost.
    const entry: SignupEntry = enqueueSignup({
      fullName,
      email,
      phone,
      role,
      organization: role === "provider" ? organization : undefined,
    });

    // Step 2: attempt network delivery (best-effort).
    let delivered = false;
    try {
      delivered = await trySendSignup(entry);
    } catch {
      delivered = false;
    }

    // Step 3: if not delivered, keep it queued and offer a prefilled mailto
    // fallback. Either way we show success — the data is safely stored.
    if (!delivered) {
      setMailtoHref(buildSignupMailto(entry));
    }

    setSubmitting(false);
    setSubmitted(true);
  };

  useEffect(() => {
    if (submitted) statusRef.current?.focus();
  }, [submitted]);

  const roleOptions: { value: SignupRole; label: string }[] = useMemo(
    () => [
      { value: "patient", label: "Patient / Member" },
      { value: "provider", label: "Provider / Clinician" },
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="sticky top-0 z-50 flex items-center justify-between px-5 sm:px-8 py-3.5 border-b bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
        <a
          href="/"
          className="flex items-center gap-2.5 group"
          aria-label="Tabula Medica — home"
          data-testid="link-signup-home"
        >
          <img
            src={logoPath}
            alt=""
            aria-hidden="true"
            className="h-10 w-10 object-contain drop-shadow-sm transition-transform group-hover:scale-105"
          />
          <span className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
            Tabula <span className="text-primary">Medica</span>
          </span>
        </a>
        <WouterLink
          href="/auth/login"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="link-signup-login"
        >
          Log In
        </WouterLink>
      </nav>

      <main
        id="main-content"
        className="flex-1 w-full max-w-xl mx-auto px-5 sm:px-8 py-10 sm:py-14"
        role="main"
      >
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground mb-4">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            Early access
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
            Request early access
          </h1>
          <p className="mt-3 text-muted-foreground">
            Be among the first to try Tabula Medica. Tell us a little about you and
            we'll reach out with an invitation. This is an early-access sign-up — please
            do not include any medical details.
          </p>
        </div>

        {/* aria-live region for status announcements */}
        <div
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
          data-testid="signup-live-region"
        >
          {submitting ? "Submitting your request…" : submitted ? "Your request has been received." : ""}
        </div>

        {submitted ? (
          <div
            ref={statusRef}
            tabIndex={-1}
            className="rounded-xl border bg-card p-6 sm:p-8 text-center shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid="signup-success"
          >
            <CheckCircle2
              className="h-12 w-12 text-primary mx-auto mb-4"
              aria-hidden="true"
            />
            <h2 className="text-xl font-semibold text-foreground">You're on the list</h2>
            <p className="mt-2 text-muted-foreground">
              Thank you for your interest in Tabula Medica. We've saved your request and
              our team will be in touch about early access.
            </p>
            {mailtoHref && (
              <div className="mt-6 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                <p className="mb-3">
                  To make sure we received it, you can also send us your details directly.
                </p>
                <a
                  href={mailtoHref}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  data-testid="signup-mailto"
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  Email your details to us
                </a>
              </div>
            )}
            <div className="mt-6">
              <WouterLink
                href="/"
                className="text-sm text-primary font-medium hover:underline"
                data-testid="signup-back-home"
              >
                Back to home
              </WouterLink>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="rounded-xl border bg-card p-6 sm:p-8 shadow-sm space-y-6"
            aria-label="Early-access sign-up form"
          >
            <div className="space-y-2">
              <Label htmlFor="signup-fullName">
                Full name <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <Input
                id="signup-fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                aria-required="true"
                aria-invalid={!!errors.fullName}
                aria-describedby={errors.fullName ? "signup-fullName-error" : undefined}
                data-testid="input-fullName"
              />
              {errors.fullName && (
                <p id="signup-fullName-error" className="text-sm text-destructive" role="alert">
                  {errors.fullName}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-email">
                Email <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <Input
                id="signup-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-required="true"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "signup-email-error" : undefined}
                data-testid="input-email"
              />
              {errors.email && (
                <p id="signup-email-error" className="text-sm text-destructive" role="alert">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-phone">
                Phone <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <Input
                id="signup-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-required="true"
                aria-invalid={!!errors.phone}
                aria-describedby={errors.phone ? "signup-phone-error" : undefined}
                data-testid="input-phone"
              />
              {errors.phone && (
                <p id="signup-phone-error" className="text-sm text-destructive" role="alert">
                  {errors.phone}
                </p>
              )}
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium leading-none">
                I am a <span className="text-destructive" aria-hidden="true">*</span>
              </legend>
              <div
                role="radiogroup"
                aria-label="I am a"
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                {roleOptions.map((opt) => {
                  const selected = role === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setRole(opt.value)}
                      className={`rounded-lg border px-4 py-3 text-sm font-medium text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        selected
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-input text-muted-foreground hover:border-primary/50"
                      }`}
                      data-testid={`toggle-role-${opt.value}`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {role === "provider" && (
              <div className="space-y-2">
                <Label htmlFor="signup-organization">
                  Practice / organization{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="signup-organization"
                  name="organization"
                  type="text"
                  autoComplete="organization"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  data-testid="input-organization"
                />
              </div>
            )}

            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
              <Checkbox
                id="signup-consent"
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
                aria-required="true"
                className="mt-0.5"
                data-testid="checkbox-consent"
              />
              <Label
                htmlFor="signup-consent"
                className="text-sm font-normal leading-relaxed text-muted-foreground cursor-pointer"
              >
                {CONSENT_TEXT}
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={!consent || submitting}
              aria-disabled={!consent || submitting}
              data-testid="button-submit-signup"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Submitting…
                </>
              ) : (
                "Request early access"
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              By continuing you agree to our{" "}
              <WouterLink href="/privacy-policy" className="underline hover:text-foreground">
                Privacy Policy
              </WouterLink>{" "}
              and{" "}
              <WouterLink href="/terms-of-service" className="underline hover:text-foreground">
                Terms of Service
              </WouterLink>
              .
            </p>
          </form>
        )}
      </main>

      <div className="mt-auto border-t">
        <footer className="max-w-xl mx-auto px-5 sm:px-8 py-6 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} Tabula Medica</span>
          <a href="/privacy-policy" className="hover:text-foreground transition-colors">Privacy</a>
          <a href="/terms-of-service" className="hover:text-foreground transition-colors">Terms</a>
          <a href="mailto:hello@tabulamedica.us" className="hover:text-foreground transition-colors">Contact</a>
        </footer>
      </div>
    </div>
  );
}
