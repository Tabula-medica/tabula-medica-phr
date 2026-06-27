/**
 * Patient EMERGENCY FOLDER (auth'd).
 * Set up the demographic emergency folder, implanted-device cards, and generate
 * a single-use break-glass QR token that EMS/ER can scan.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Loader2, Plus, Trash2, ShieldCheck, QrCode, HeartPulse } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PROFILE_FIELDS: { key: string; label: string; full?: boolean; area?: boolean; image?: boolean }[] = [
  { key: "bloodType", label: "Blood type" },
  { key: "nextOfKinName", label: "Next of kin — name" },
  { key: "nextOfKinPhone", label: "Next of kin — phone" },
  { key: "nextOfKinRelationship", label: "Next of kin — relationship" },
  { key: "pharmacyName", label: "Pharmacy name", full: true },
  { key: "pharmacyPhone", label: "Pharmacy phone", full: true },
  { key: "pcpName", label: "PCP name", full: true },
  { key: "pcpPhone", label: "PCP phone", full: true },
  { key: "advanceDirectiveStatus", label: "Advance directive (none/on_file/dnr/polst/living_will)" },
  { key: "insuranceProvider", label: "Insurance provider", full: true },
  { key: "insuranceMemberId", label: "Insurance member ID", full: true },
  { key: "insuranceCardFrontUrl", label: "Insurance card (front)", full: true, image: true },
  { key: "insuranceCardBackUrl", label: "Insurance card (back)", full: true, image: true },
  { key: "latestHealthSummary", label: "Latest health summary", full: true, area: true },
];

// Upload an image to object storage via a signed URL; returns the stored path.
async function uploadImage(file: File): Promise<string> {
  const { uploadURL, objectPath } = await apiRequest("POST", "/api/emergency/upload-url", {}).then((r) => r.json());
  const put = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
  if (!put.ok) throw new Error("upload failed");
  return objectPath;
}

function ImageUploadInput({ value, onUploaded }: { value?: string; onUploaded: (path: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  return (
    <div className="space-y-1">
      <input type="file" accept="image/*" capture="environment" disabled={busy} className="text-xs"
        onChange={async (e) => {
          const file = e.target.files?.[0]; if (!file) return;
          setBusy(true); setErr(false);
          try { onUploaded(await uploadImage(file)); } catch { setErr(true); } finally { setBusy(false); }
        }} />
      {busy && <span className="text-xs text-muted-foreground">Uploading…</span>}
      {err && <span className="text-xs text-red-600">Upload failed</span>}
      {value && <a href={value} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline block truncate">view uploaded image</a>}
    </div>
  );
}

export default function EmergencyFolder() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const profileQ = useQuery<any>({ queryKey: ["/api/emergency/profile"] });
  const devicesQ = useQuery<any[]>({ queryKey: ["/api/emergency/devices"] });
  const tokensQ = useQuery<any[]>({ queryKey: ["/api/emergency/tokens"] });
  const logsQ = useQuery<any[]>({ queryKey: ["/api/emergency/access-logs"] });

  const [form, setForm] = useState<Record<string, any>>({});
  const profile = { ...(profileQ.data ?? {}), ...form };

  const saveProfile = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/emergency/profile", profile).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/emergency/profile"] }); setForm({}); toast({ title: "Emergency folder saved" }); },
    onError: () => toast({ title: "Could not save", variant: "destructive" }),
  });

  const [device, setDevice] = useState<Record<string, any>>({ deviceType: "pacemaker", status: "active" });
  const addDevice = useMutation({
    mutationFn: () => apiRequest("POST", "/api/emergency/devices", device).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/emergency/devices"] }); setDevice({ deviceType: "pacemaker", status: "active" }); toast({ title: "Device card added" }); },
    onError: () => toast({ title: "Add device, name required", variant: "destructive" }),
  });
  const delDevice = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/emergency/devices/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/emergency/devices"] }),
  });

  const [tok, setTok] = useState<{ pin?: string; dob?: string; label?: string; expiresInHours?: number }>({ expiresInHours: 720 });
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const createToken = useMutation({
    mutationFn: () => apiRequest("POST", "/api/emergency/token", tok).then((r) => r.json()),
    onSuccess: async (res: any) => {
      const url = `${window.location.origin}/emergency-access/${res.token}`;
      setShareUrl(url);
      setQrUrl(await QRCode.toDataURL(url, { width: 256, margin: 1 }));
      qc.invalidateQueries({ queryKey: ["/api/emergency/tokens"] });
      toast({ title: "Emergency QR generated" });
    },
    onError: () => toast({ title: "Could not generate token", variant: "destructive" }),
  });
  const revoke = useMutation({
    mutationFn: (token: string) => apiRequest("POST", `/api/emergency/token/${encodeURIComponent(token)}/revoke`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/emergency/tokens"] }); toast({ title: "Token revoked" }); },
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-4">
        <HeartPulse className="h-7 w-7 text-red-600" />
        <div>
          <h1 className="text-2xl font-bold">Emergency folder</h1>
          <p className="text-sm text-muted-foreground">Critical info EMS can see by scanning your QR. You control what's shared and can revoke anytime.</p>
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList className="mb-4">
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="devices">Device cards</TabsTrigger>
          <TabsTrigger value="qr">Emergency QR</TabsTrigger>
          <TabsTrigger value="log">Access log</TabsTrigger>
        </TabsList>

        {/* INFO */}
        <TabsContent value="info">
          <Card>
            <CardHeader><CardTitle>Demographic & emergency info</CardTitle>
              <CardDescription>Fields marked “full” are only shown after EMS enters your PIN or DOB.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                {PROFILE_FIELDS.map((f) => (
                  <div key={f.key} className={f.area ? "sm:col-span-2" : ""}>
                    <Label htmlFor={f.key} className="text-xs">{f.label}{f.full && <Badge variant="secondary" className="ml-2">full</Badge>}</Label>
                    {f.image
                      ? <ImageUploadInput value={profile[f.key]} onUploaded={(p) => set(f.key, p)} />
                      : f.area
                      ? <Textarea id={f.key} value={profile[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} rows={3} />
                      : <Input id={f.key} value={profile[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <div>
                  <Label className="font-medium">Allow PIN-less basic access</Label>
                  <p className="text-xs text-muted-foreground">EMS sees critical basics (allergies, conditions, devices, DNR, contact) without a PIN. Recommended for life-safety.</p>
                </div>
                <Switch checked={profile.allowPinlessBasic ?? true} onCheckedChange={(v) => set("allowPinlessBasic", v)} />
              </div>
              <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>{saveProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DEVICES */}
        <TabsContent value="devices">
          <Card className="mb-4">
            <CardHeader><CardTitle className="text-base">Add implanted device card</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-3">
              {[["deviceType", "Type (pacemaker/defibrillator/stent/icd/insulin_pump/…)"], ["name", "Name *"], ["manufacturer", "Manufacturer"], ["modelNumber", "Model #"], ["serialNumber", "Serial #"], ["location", "Body location"]].map(([k, label]) => (
                <div key={k}><Label className="text-xs">{label}</Label><Input value={device[k] ?? ""} onChange={(e) => setDevice((d) => ({ ...d, [k]: e.target.value }))} /></div>
              ))}
              <div><Label className="text-xs">Device ID card photo</Label><ImageUploadInput value={device.cardImageUrl} onUploaded={(p) => setDevice((d) => ({ ...d, cardImageUrl: p }))} /></div>
              <div className="flex items-center gap-2"><Switch checked={device.mriConditional ?? false} onCheckedChange={(v) => setDevice((d) => ({ ...d, mriConditional: v }))} /><Label className="text-xs">MRI conditional</Label></div>
              <div className="sm:col-span-2"><Button onClick={() => addDevice.mutate()} disabled={addDevice.isPending || !device.name}><Plus className="h-4 w-4 mr-1" />Add device card</Button></div>
            </CardContent>
          </Card>
          {(devicesQ.data ?? []).map((d) => (
            <Card key={d.id} className="mb-2"><CardContent className="flex items-center justify-between py-3">
              <div><div className="font-medium capitalize">{d.deviceType?.replace(/_/g, " ")} — {d.name}</div>
                <div className="text-xs text-muted-foreground">{[d.manufacturer, d.modelNumber, d.serialNumber, d.location, d.mriConditional ? "MRI conditional" : null].filter(Boolean).join(" · ")}</div></div>
              <Button variant="ghost" size="icon" onClick={() => delDevice.mutate(d.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
            </CardContent></Card>
          ))}
          {(devicesQ.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No device cards on file.</p>}
        </TabsContent>

        {/* QR */}
        <TabsContent value="qr">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" />Generate emergency QR</CardTitle>
              <CardDescription>Single-use full-tier access. Set a PIN and/or your DOB to gate the full record.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid sm:grid-cols-3 gap-3">
                <div><Label className="text-xs">Full-tier PIN</Label><Input value={tok.pin ?? ""} onChange={(e) => setTok((t) => ({ ...t, pin: e.target.value }))} /></div>
                <div><Label className="text-xs">DOB (alt unlock)</Label><Input value={tok.dob ?? ""} onChange={(e) => setTok((t) => ({ ...t, dob: e.target.value }))} placeholder="YYYY-MM-DD" /></div>
                <div><Label className="text-xs">Label</Label><Input value={tok.label ?? ""} onChange={(e) => setTok((t) => ({ ...t, label: e.target.value }))} placeholder="wallet card" /></div>
              </div>
              <Button onClick={() => createToken.mutate()} disabled={createToken.isPending}>{createToken.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate QR"}</Button>
              {qrUrl && (
                <div className="text-center border-t pt-4">
                  <img src={qrUrl} alt="Emergency QR" className="mx-auto" />
                  <p className="text-xs text-muted-foreground mt-2 break-all">{shareUrl}</p>
                  <p className="text-xs text-muted-foreground mt-1"><ShieldCheck className="h-3 w-3 inline" /> Print for your wallet or save to your phone's lock screen.</p>
                </div>
              )}
              <div className="border-t pt-3">
                <p className="text-sm font-medium mb-2">Active tokens</p>
                {(tokensQ.data ?? []).map((t) => (
                  <div key={t.token} className="flex items-center justify-between text-sm py-1">
                    <span>{t.label || "token"} · {t.revoked ? <Badge variant="destructive">revoked</Badge> : <Badge variant="secondary">active</Badge>} · full uses {t.accessCount}/{t.maxAccesses}</span>
                    {!t.revoked && <Button variant="ghost" size="sm" onClick={() => revoke.mutate(t.token)}>Revoke</Button>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LOG */}
        <TabsContent value="log">
          <Card>
            <CardHeader><CardTitle>Break-glass access log</CardTitle><CardDescription>Every scan of your emergency QR.</CardDescription></CardHeader>
            <CardContent>
              {(logsQ.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No accesses yet.</p> :
                (logsQ.data ?? []).map((l) => (
                  <div key={l.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                    <span>{new Date(l.accessedAt).toLocaleString()} · <Badge variant={l.tier === "full" ? "default" : "secondary"}>{l.tier}</Badge> {l.success ? "✓" : <span className="text-red-600">✕ {l.detail}</span>}</span>
                    <span className="text-xs text-muted-foreground">{l.accessorAgency || l.ipAddress}</span>
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
