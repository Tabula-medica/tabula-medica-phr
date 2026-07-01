import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Loader2, Heart } from "lucide-react";

/**
 * The ONE post-login onboarding screen: full name + basic demographics.
 *
 * Replaces the 20+ confusing onboarding wizard variants on the post-login
 * path. Shown by the App.tsx gate when an authenticated user has not yet
 * completed onboarding. On submit we:
 *   1. POST /api/patient-onboarding/complete  -> persist demographics
 *   2. POST /api/onboarding/complete          -> flip hasCompletedOnboarding
 *      (this is the flag the server checks on every login to decide
 *       needsOnboarding, so returning users skip this screen)
 * then invalidate the gate's queries so the app renders.
 */
export default function SimpleOnboarding({ onDone }: { onDone?: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !dateOfBirth) {
      setError("Please enter your name and date of birth.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      // 1) Persist the demographics.
      await apiRequest("POST", "/api/patient-onboarding/complete", {
        formData: {
          personalInfo: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            dateOfBirth,
            gender: gender || undefined,
            zipCode: zipCode.trim() || undefined,
          },
        },
        completedSteps: ["profile"],
      });

      // 2) Flip the onboarding-complete flag the login flow reads.
      await apiRequest("POST", "/api/onboarding/complete", {
        completedSteps: ["profile"],
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/status"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      onDone?.();
    } catch (err) {
      setError(
        (err as Error)?.message?.replace(/^\d+:\s*/, "") ||
          "Could not save your details. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-background px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="Tabula Medica" className="h-10 mx-auto mb-4" />
          <div className="inline-flex items-center gap-2 text-primary">
            <Heart className="h-5 w-5" />
            <span className="text-sm font-medium">Let&apos;s set up your profile</span>
          </div>
        </div>
        <Card className="border-slate-200 dark:border-border/60 bg-white dark:bg-card shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl font-normal">Tell us about you</CardTitle>
            <CardDescription>
              We use this to match and organize your health records. You can edit it later in Settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4" data-testid="alert-onboarding-error">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                    disabled={busy}
                    data-testid="input-first-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                    disabled={busy}
                    data-testid="input-last-name"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dateOfBirth">Date of birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  autoComplete="bday"
                  max={new Date().toISOString().slice(0, 10)}
                  disabled={busy}
                  data-testid="input-date-of-birth"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="gender">Sex / gender</Label>
                  <Select value={gender} onValueChange={setGender} disabled={busy}>
                    <SelectTrigger id="gender" data-testid="select-gender">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="zipCode">ZIP code (optional)</Label>
                  <Input
                    id="zipCode"
                    inputMode="numeric"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value.replace(/[^0-9-]/g, ""))}
                    autoComplete="postal-code"
                    maxLength={10}
                    disabled={busy}
                    data-testid="input-zip"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={busy}
                data-testid="button-onboarding-submit"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Continue to my health record"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
