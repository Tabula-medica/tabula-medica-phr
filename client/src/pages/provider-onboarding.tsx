import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, Stethoscope } from "lucide-react";
import { providerSpecialties, providerTypes } from "@shared/schema";
import { useSEO } from "@/hooks/use-seo";

const label = (v: string) => v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Provider onboarding — lets a clinician add themselves to the searchable
 * (zip + specialty) directory. Posts to /api/provider-integration/providers/apply;
 * self-serve applications are held as "pending" for admin approval before they
 * appear in patient search.
 */
export default function ProviderOnboarding() {
  useSEO({ title: "Join the Provider Directory | Tabula Medica", description: "Add your practice to the Tabula Medica provider directory." });
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | "pending" | "active">(null);

  const [f, setF] = useState({
    firstName: "", lastName: "", npi: "", providerType: "physician",
    primarySpecialty: "family_medicine", languages: "English", bio: "",
    locName: "", addressLine1: "", city: "", state: "", zipCode: "", phone: "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  const valid =
    f.firstName.trim() && f.lastName.trim() && /^\d{10}$/.test(f.npi.trim()) &&
    f.primarySpecialty && f.city.trim() && /^\d{5}/.test(f.zipCode.trim());

  const submit = async () => {
    if (!valid) {
      toast({ title: "Missing details", description: "First/last name, a 10-digit NPI, specialty, city and ZIP are required.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const resp = await fetch("/api/provider-integration/providers/apply", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({
          npi: f.npi.trim(),
          firstName: f.firstName.trim(),
          lastName: f.lastName.trim(),
          providerType: f.providerType,
          primarySpecialty: f.primarySpecialty,
          specialties: [f.primarySpecialty],
          languages: f.languages.split(",").map((s) => s.trim()).filter(Boolean),
          bio: f.bio.trim() || undefined,
          location: {
            name: f.locName.trim() || `${f.firstName} ${f.lastName}`,
            addressLine1: f.addressLine1.trim(),
            city: f.city.trim(),
            state: f.state.trim().toUpperCase(),
            zipCode: f.zipCode.trim(),
            phone: f.phone.trim(),
          },
        }),
      });
      if (!resp.ok) {
        const b = await resp.json().catch(() => ({}));
        throw new Error(b?.error || "Could not submit your application.");
      }
      const b = await resp.json();
      setDone(b.status === "active" ? "active" : "pending");
    } catch (e: any) {
      toast({ title: "Submission failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <CheckCircle className="h-10 w-10 text-green-600 mx-auto" />
            <h2 className="text-xl font-semibold">
              {done === "active" ? "You're listed!" : "Application received"}
            </h2>
            <p className="text-muted-foreground">
              {done === "active"
                ? "Your practice is now searchable in the provider directory."
                : "Thanks — your application is pending review. Once approved, you'll appear in patient search by specialty and ZIP."}
            </p>
            <Button onClick={() => setLocation("/")} data-testid="button-done">Back to home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Stethoscope className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Join the provider directory</h1>
          <p className="text-sm text-muted-foreground">Patients find you by specialty and ZIP code.</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">About you</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>First name</Label><Input value={f.firstName} onChange={set("firstName")} data-testid="input-first-name" /></div>
          <div className="space-y-1.5"><Label>Last name</Label><Input value={f.lastName} onChange={set("lastName")} data-testid="input-last-name" /></div>
          <div className="space-y-1.5"><Label>NPI (10 digits)</Label><Input value={f.npi} onChange={set("npi")} inputMode="numeric" placeholder="1234567890" data-testid="input-npi" /></div>
          <div className="space-y-1.5">
            <Label>Provider type</Label>
            <Select value={f.providerType} onValueChange={(v) => setF({ ...f, providerType: v })}>
              <SelectTrigger data-testid="select-provider-type"><SelectValue /></SelectTrigger>
              <SelectContent>{providerTypes.map((t) => <SelectItem key={t} value={t}>{label(t)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Primary specialty</Label>
            <Select value={f.primarySpecialty} onValueChange={(v) => setF({ ...f, primarySpecialty: v })}>
              <SelectTrigger data-testid="select-specialty"><SelectValue /></SelectTrigger>
              <SelectContent>{providerSpecialties.map((s) => <SelectItem key={s} value={s}>{label(s)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Languages (comma-separated)</Label><Input value={f.languages} onChange={set("languages")} placeholder="English, Spanish" data-testid="input-languages" /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Practice location</CardTitle><CardDescription>Used for the ZIP-radius search.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label>Practice name</Label><Input value={f.locName} onChange={set("locName")} placeholder="e.g., Riverside Family Care" data-testid="input-loc-name" /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Address</Label><Input value={f.addressLine1} onChange={set("addressLine1")} data-testid="input-address" /></div>
          <div className="space-y-1.5"><Label>City</Label><Input value={f.city} onChange={set("city")} data-testid="input-city" /></div>
          <div className="space-y-1.5"><Label>State</Label><Input value={f.state} onChange={set("state")} maxLength={2} placeholder="VA" data-testid="input-state" /></div>
          <div className="space-y-1.5"><Label>ZIP code</Label><Input value={f.zipCode} onChange={set("zipCode")} inputMode="numeric" placeholder="22314" data-testid="input-zip" /></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input value={f.phone} onChange={set("phone")} inputMode="tel" data-testid="input-phone" /></div>
        </CardContent>
      </Card>

      <Button className="w-full" size="lg" onClick={submit} disabled={busy || !valid} data-testid="button-submit-provider">
        {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting…</> : "Submit application"}
      </Button>
    </div>
  );
}
