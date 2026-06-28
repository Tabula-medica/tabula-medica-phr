import { useEffect, useState } from "react";
import { useParams } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  ShieldAlert,
  Heart,
  Phone,
  Stethoscope,
  Pill,
  FileText,
  CreditCard,
  Droplet,
  Loader2,
  Lock,
  User,
} from "lucide-react";

interface EmergencyContactView {
  name: string;
  relationship: string;
  phone: string;
  email: string;
}

interface EmergencyView {
  patient: { name: string; dob: string };
  bloodType: string;
  allergiesSummary: string;
  criticalConditions: string;
  latestSummaryText: string;
  emergencyContact: EmergencyContactView;
  pcp: { name: string; phone: string };
  pharmacy: { name: string; phone: string; address: string };
  advanceDirective: {
    hasDirective: boolean;
    type: string;
    notes: string;
    fileUrl: string | null;
  };
  insuranceCard: {
    payer: string;
    memberId: string;
    groupNumber: string;
    frontUrl: string | null;
    backUrl: string | null;
  };
  accessedAt: string;
}

const DIRECTIVE_LABELS: Record<string, string> = {
  dnr: "Do Not Resuscitate (DNR)",
  living_will: "Living Will",
  healthcare_proxy: "Healthcare Proxy",
  other: "Other",
};

type Status = "loading" | "ok" | "pin" | "error";

export default function EmergencyViewPage() {
  const params = useParams();
  const token = (params as Record<string, string>).token || "";

  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<EmergencyView | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function redeem(pinValue: string) {
    setSubmitting(true);
    setPinError(false);
    try {
      const qs = new URLSearchParams({ token });
      if (pinValue) qs.set("pin", pinValue);
      const res = await fetch(`/api/emergency/redeem?${qs.toString()}`, {
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      if (res.status === 401) {
        // PIN required or incorrect.
        setStatus("pin");
        setPinError(pinValue.length > 0);
        return;
      }
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const json = (await res.json()) as EmergencyView;
      setData(json);
      setStatus("ok");
    } catch {
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  }

  // On mount, attempt redemption using any ?pin in the URL.
  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }
    const urlPin = new URLSearchParams(window.location.search).get("pin") || "";
    if (urlPin) setPin(urlPin);
    redeem(urlPin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-screen bg-background">
      {/* Break-glass banner — always visible. */}
      <div
        className="bg-red-600 text-white px-4 py-3 flex items-center gap-2 sticky top-0 z-10"
        role="alert"
        data-testid="emergency-banner"
      >
        <ShieldAlert className="w-5 h-5 shrink-0" />
        <span className="font-semibold">
          Emergency / Break-Glass — access logged
        </span>
      </div>

      <div className="container mx-auto max-w-2xl p-4 space-y-4">
        {status === "loading" && (
          <div
            className="flex items-center justify-center py-24"
            data-testid="emergency-loading"
          >
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {status === "error" && (
          <Card data-testid="emergency-error">
            <CardContent className="p-8 text-center space-y-3">
              <AlertTriangle className="w-12 h-12 mx-auto text-orange-500" />
              <h2 className="text-lg font-semibold">Link unavailable</h2>
              <p className="text-muted-foreground">
                This emergency share link is invalid, has expired, or has been
                revoked. Ask the patient to generate a new link.
              </p>
            </CardContent>
          </Card>
        )}

        {status === "pin" && (
          <Card data-testid="emergency-pin">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-primary" />
                Enter PIN
              </CardTitle>
              <CardDescription>
                This emergency share is protected by a PIN provided by the
                patient.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="emergency-pin-input">PIN</Label>
                <Input
                  id="emergency-pin-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") redeem(pin);
                  }}
                  placeholder="••••"
                  data-testid="input-emergency-pin"
                />
                {pinError && (
                  <p className="text-sm text-destructive">
                    Incorrect PIN. Please try again.
                  </p>
                )}
              </div>
              <Button
                onClick={() => redeem(pin)}
                disabled={submitting || !pin}
                className="w-full"
                data-testid="button-emergency-pin-submit"
              >
                {submitting ? "Checking..." : "View Emergency Info"}
              </Button>
            </CardContent>
          </Card>
        )}

        {status === "ok" && data && (
          <div className="space-y-4" data-testid="emergency-content">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  {data.patient.name || "Patient"}
                </CardTitle>
                <CardDescription>
                  {data.patient.dob ? `DOB: ${data.patient.dob}` : null}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  {data.bloodType && (
                    <Badge
                      variant="destructive"
                      className="text-sm flex items-center gap-1"
                      data-testid="emergency-blood-type"
                    >
                      <Droplet className="w-3 h-3" /> Blood type:{" "}
                      {data.bloodType}
                    </Badge>
                  )}
                </div>

                {data.allergiesSummary && (
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-1 text-orange-600">
                      <AlertTriangle className="w-4 h-4" /> Allergies
                    </p>
                    <p className="text-sm whitespace-pre-wrap">
                      {data.allergiesSummary}
                    </p>
                  </div>
                )}

                {data.criticalConditions && (
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-1">
                      <Heart className="w-4 h-4 text-red-500" /> Critical
                      conditions
                    </p>
                    <p className="text-sm whitespace-pre-wrap">
                      {data.criticalConditions}
                    </p>
                  </div>
                )}

                {data.latestSummaryText && (
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-1">
                      <FileText className="w-4 h-4" /> Summary
                    </p>
                    <p className="text-sm whitespace-pre-wrap">
                      {data.latestSummaryText}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {(data.emergencyContact?.name || data.pcp?.name) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Phone className="w-4 h-4 text-primary" /> Contacts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.emergencyContact?.name && (
                    <div>
                      <p className="text-sm font-medium">
                        Emergency contact: {data.emergencyContact.name}
                        {data.emergencyContact.relationship
                          ? ` (${data.emergencyContact.relationship})`
                          : ""}
                      </p>
                      {data.emergencyContact.phone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" />{" "}
                          {data.emergencyContact.phone}
                        </p>
                      )}
                    </div>
                  )}
                  {data.pcp?.name && (
                    <div>
                      <p className="text-sm font-medium flex items-center gap-1">
                        <Stethoscope className="w-4 h-4" /> PCP: {data.pcp.name}
                      </p>
                      {data.pcp.phone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {data.pcp.phone}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {(data.pharmacy?.name || data.pharmacy?.phone) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Pill className="w-4 h-4 text-primary" /> Pharmacy
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {data.pharmacy.name && (
                    <p className="text-sm font-medium">{data.pharmacy.name}</p>
                  )}
                  {data.pharmacy.phone && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {data.pharmacy.phone}
                    </p>
                  )}
                  {data.pharmacy.address && (
                    <p className="text-sm text-muted-foreground">
                      {data.pharmacy.address}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {(data.advanceDirective?.hasDirective ||
              data.advanceDirective?.notes ||
              data.advanceDirective?.fileUrl) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="w-4 h-4 text-primary" /> Advance
                    Directive
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.advanceDirective.type && (
                    <Badge variant="outline">
                      {DIRECTIVE_LABELS[data.advanceDirective.type] ||
                        data.advanceDirective.type}
                    </Badge>
                  )}
                  {data.advanceDirective.notes && (
                    <p className="text-sm whitespace-pre-wrap">
                      {data.advanceDirective.notes}
                    </p>
                  )}
                  {data.advanceDirective.fileUrl && (
                    <Button asChild variant="outline" size="sm">
                      <a
                        href={data.advanceDirective.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        data-testid="link-advance-directive"
                      >
                        <FileText className="w-4 h-4 mr-2" /> View document
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {(data.insuranceCard?.payer ||
              data.insuranceCard?.memberId ||
              data.insuranceCard?.frontUrl) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CreditCard className="w-4 h-4 text-primary" /> Insurance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.insuranceCard.payer && (
                    <p className="text-sm font-medium">
                      {data.insuranceCard.payer}
                    </p>
                  )}
                  {data.insuranceCard.memberId && (
                    <p className="text-sm text-muted-foreground">
                      Member ID: {data.insuranceCard.memberId}
                    </p>
                  )}
                  {data.insuranceCard.groupNumber && (
                    <p className="text-sm text-muted-foreground">
                      Group: {data.insuranceCard.groupNumber}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {data.insuranceCard.frontUrl && (
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={data.insuranceCard.frontUrl}
                          target="_blank"
                          rel="noreferrer"
                          data-testid="link-insurance-front"
                        >
                          Front of card
                        </a>
                      </Button>
                    )}
                    {data.insuranceCard.backUrl && (
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={data.insuranceCard.backUrl}
                          target="_blank"
                          rel="noreferrer"
                          data-testid="link-insurance-back"
                        >
                          Back of card
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Separator />
            <p className="text-xs text-muted-foreground text-center pb-6">
              This is a minimal emergency summary shared by the patient. Every
              access is logged and the patient can revoke this link at any time.
              Accessed {new Date(data.accessedAt).toLocaleString()}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
