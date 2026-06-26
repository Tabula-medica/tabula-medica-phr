/**
 * EMERGENCY BREAK-GLASS VIEW (public — EMS/ER).
 *
 * Rendered for /emergency-access/:token without authentication (EMS has no app
 * identity). Shows the BASIC life-safety tier immediately; the FULL tier is
 * unlocked with a PIN or the patient's DOB. Every access is audited server-side.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, ShieldAlert, HeartPulse, Lock, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Row = { label: string; value?: string | null };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-3">
      <CardHeader className="py-3"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

function Field({ label, value }: Row) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || "—"}</span>
    </div>
  );
}

export default function EmergencyAccess() {
  const [location] = useLocation();
  const token = decodeURIComponent(location.replace(/^\/emergency-access\//, "").split(/[/?]/)[0] || "");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [basic, setBasic] = useState<any>(null);
  const [fullAvailable, setFullAvailable] = useState(false);
  const [full, setFull] = useState<any>(null);
  const [pin, setPin] = useState("");
  const [dob, setDob] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/emergency/access/${encodeURIComponent(token)}`, { credentials: "omit" });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) { setError(body?.error || "This emergency link is not valid."); return; }
        setBasic(body.data);
        setFullAvailable(Boolean(body.fullTierAvailable));
      } catch {
        if (!cancelled) setError("Could not reach the emergency service.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  async function unlockFull(e: React.FormEvent) {
    e.preventDefault();
    setUnlocking(true);
    setUnlockError(null);
    try {
      const res = await fetch(`/api/emergency/access/${encodeURIComponent(token)}/full`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        credentials: "omit",
        body: JSON.stringify({ pin: pin || undefined, dob: dob || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setUnlockError(body?.error || "Unlock failed."); return; }
      setFull(body.data);
    } catch {
      setUnlockError("Could not reach the emergency service.");
    } finally {
      setUnlocking(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-red-600" /></div>;
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-16 px-4 text-center">
        <ShieldAlert className="h-12 w-12 text-red-600 mx-auto mb-3" />
        <h1 className="text-xl font-semibold mb-2">Emergency access unavailable</h1>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  const d = full ?? basic ?? {};

  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      <div className="bg-red-600 text-white rounded-lg p-4 mb-4 flex items-center gap-3">
        <HeartPulse className="h-7 w-7 shrink-0" />
        <div>
          <div className="text-lg font-bold leading-tight">EMERGENCY MEDICAL INFORMATION</div>
          <div className="text-xs opacity-90">Break-glass access · this view is logged for HIPAA audit</div>
        </div>
      </div>

      <Section title="Critical">
        <Field label="Blood type" value={d.bloodType} />
        <Field label="Organ donor" value={d.organDonor == null ? "—" : d.organDonor ? "Yes" : "No"} />
        <Field label="Advance directive" value={d.advanceDirective?.status?.toUpperCase?.()} />
      </Section>

      <Section title="Allergies">
        {(d.allergies ?? []).length === 0 ? <p className="text-sm text-muted-foreground">None recorded</p> :
          d.allergies.map((a: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-1 text-sm border-b last:border-0">
              <span className="font-medium">{a.name}</span>
              <Badge variant={a.severity === "life_threatening" || a.severity === "severe" ? "destructive" : "secondary"}>{a.severity}{a.reaction ? ` · ${a.reaction}` : ""}</Badge>
            </div>
          ))}
      </Section>

      <Section title="Conditions">
        {(d.conditions ?? []).length === 0 ? <p className="text-sm text-muted-foreground">None recorded</p> :
          d.conditions.map((c: any, i: number) => <Field key={i} label={c.name} value={c.icdCode || c.severity || ""} />)}
      </Section>

      <Section title="Implanted devices">
        {(d.implantedDevices ?? []).length === 0 ? <p className="text-sm text-muted-foreground">None on file</p> :
          d.implantedDevices.map((dev: any, i: number) => (
            <div key={i} className="py-2 border-b last:border-0 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium capitalize">{dev.deviceType?.replace(/_/g, " ")} — {dev.name}</span>
                {dev.mriConditional != null && <Badge variant={dev.mriConditional ? "secondary" : "destructive"}>{dev.mriConditional ? "MRI conditional" : "MRI UNSAFE"}</Badge>}
              </div>
              <div className="text-muted-foreground text-xs mt-0.5">
                {[dev.manufacturer, dev.modelNumber && `Model ${dev.modelNumber}`, dev.serialNumber && `SN ${dev.serialNumber}`, dev.location].filter(Boolean).join(" · ")}
              </div>
              {dev.cardImageUrl && <a href={dev.cardImageUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">device card image</a>}
            </div>
          ))}
      </Section>

      <Section title="Current medications">
        {(d.criticalMedications ?? []).length === 0 ? <p className="text-sm text-muted-foreground">None recorded</p> :
          d.criticalMedications.map((m: any, i: number) => <Field key={i} label={m.name} value={[m.dosage, m.frequency].filter(Boolean).join(" · ")} />)}
      </Section>

      <Section title="Emergency contact">
        <Field label="Name" value={d.emergencyContact?.name} />
        <Field label="Phone" value={d.emergencyContact?.phone} />
        <Field label="Relationship" value={d.emergencyContact?.relationship} />
      </Section>

      {/* FULL tier */}
      {full ? (
        <>
          <Section title="Health summary">
            <p className="text-sm whitespace-pre-wrap">{full.healthSummary || "—"}</p>
          </Section>
          <Section title="Insurance">
            <Field label="Provider" value={full.insurance?.provider} />
            <Field label="Member ID" value={full.insurance?.memberId} />
            {full.insurance?.cardFrontUrl && <a href={full.insurance.cardFrontUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">insurance card (front)</a>}
            {full.insurance?.cardBackUrl && <> · <a href={full.insurance.cardBackUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">back</a></>}
          </Section>
          <Section title="Pharmacy & PCP">
            <Field label="Pharmacy" value={[full.pharmacy?.name, full.pharmacy?.phone].filter(Boolean).join(" · ")} />
            <Field label="Primary care" value={[full.primaryCarePhysician?.name, full.primaryCarePhysician?.phone].filter(Boolean).join(" · ")} />
          </Section>
        </>
      ) : fullAvailable ? (
        <Card className="border-amber-300">
          <CardHeader className="py-3"><CardTitle className="text-base flex items-center gap-2"><Lock className="h-4 w-4" /> Unlock full record</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={unlockFull} className="space-y-3">
              <p className="text-xs text-muted-foreground">Enter the patient's emergency PIN or date of birth to view insurance, pharmacy, PCP, and full summary. One-time access.</p>
              <div><Label htmlFor="pin">PIN</Label><Input id="pin" value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" autoComplete="off" /></div>
              <div className="text-center text-xs text-muted-foreground">or</div>
              <div><Label htmlFor="dob">Date of birth</Label><Input id="dob" value={dob} onChange={(e) => setDob(e.target.value)} placeholder="YYYY-MM-DD" autoComplete="off" /></div>
              {unlockError && <p className="text-sm text-red-600 flex items-center gap-1"><AlertTriangle className="h-4 w-4" />{unlockError}</p>}
              <Button type="submit" disabled={unlocking || (!pin && !dob)} className="w-full">{unlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock full record"}</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-center text-xs text-muted-foreground mt-6">Provided by the patient via Tabula Medica · access recorded</p>
    </div>
  );
}
