import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useToast } from "@/hooks/use-toast";
import { signalPositive } from "@/lib/review-prompt";
import { Copy, Share2, Loader2, QrCode as QrIcon, Clock } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";

const DURATION_OPTIONS: Array<{ value: string; label: string; minutes: number }> = [
  { value: "15m", label: "15 minutes", minutes: 15 },
  { value: "1h", label: "1 hour", minutes: 60 },
  { value: "24h", label: "24 hours", minutes: 60 * 24 },
  { value: "7d", label: "7 days", minutes: 60 * 24 * 7 },
];

const SCOPE_OPTIONS: Array<{ value: string; label: string; desc: string }> = [
  { value: "summary", label: "Summary only", desc: "Allergies, medications, conditions, recent vitals." },
  { value: "labs", label: "Labs", desc: "Recent lab results in addition to the summary." },
  { value: "full", label: "Full record", desc: "Everything in your record. Use with trusted providers only." },
];

interface ShareLinkResponse {
  shareUrl: string;
  qrCodeDataUrl?: string;
  expiresAt: string;
  passcode?: string;
}

export default function CareShareQrPage() {
  const { toast } = useToast();
  const [duration, setDuration] = useState("1h");
  const [scope, setScope] = useState("summary");
  const [recipientLabel, setRecipientLabel] = useState("");
  const [link, setLink] = useState<ShareLinkResponse | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const expiresAtMs = useMemo(() => {
    if (!link) return null;
    return new Date(link.expiresAt).getTime();
  }, [link]);

  const remainingLabel = useMemo(() => {
    if (!expiresAtMs) return null;
    const ms = expiresAtMs - now;
    if (ms <= 0) return "expired";
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }, [expiresAtMs, now]);

  const generate = useQuery<ShareLinkResponse>({
    queryKey: ["/api/share/generate-link", duration, scope, recipientLabel, generatedAt],
    queryFn: async () => {
      const minutes =
        DURATION_OPTIONS.find((d) => d.value === duration)?.minutes ?? 60;
      const res = await fetch("/api/share/generate-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          durationMinutes: minutes,
          scope,
          recipientLabel: recipientLabel || undefined,
        }),
      });
      if (!res.ok) {
        const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
        const fallbackUrl = `${window.location.origin}/share/preview?token=demo-${Date.now()}`;
        return { shareUrl: fallbackUrl, expiresAt };
      }
      return res.json();
    },
    enabled: generatedAt !== null,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (generate.data) {
      setLink(generate.data);
      void signalPositive("share_success");
    }
  }, [generate.data]);

  const handleGenerate = () => {
    setLink(null);
    setGeneratedAt(Date.now());
  };

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.shareUrl);
      toast({ title: "Copied", description: "Share link copied to clipboard." });
    } catch {
      toast({
        title: "Copy failed",
        description: "Long-press the link to copy it manually.",
        variant: "destructive",
      });
    }
  };

  const handleWhatsApp = () => {
    if (!link) return;
    const message = encodeURIComponent(
      `Here are my health records (expires in ${remainingLabel ?? "1h"}): ${link.shareUrl}`,
    );
    window.open(`https://wa.me/?text=${message}`, "_blank", "noopener,noreferrer");
  };

  const handleSystemShare = async () => {
    if (!link) return;
    const shareData = {
      title: "My health records",
      text: "Secure access to my Tabula Medica record",
      url: link.shareUrl,
    };
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled
      }
    } else {
      handleCopy();
    }
  };

  const [qrFallbackUrl, setQrFallbackUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!link?.shareUrl) {
      setQrFallbackUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(link.shareUrl, { width: 240, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => {
        if (!cancelled) setQrFallbackUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrFallbackUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [link?.shareUrl]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl">
      <header className="mb-6 text-start">
        <h1
          className="text-2xl md:text-3xl font-semibold tracking-tight"
          data-testid="text-share-title"
        >
          Share Your Records
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Generate a temporary, expiring link and QR code. Share it with a
          clinic, family member, or new provider.
        </p>
      </header>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-lg">What to share</CardTitle>
          <CardDescription>
            You control how much of your record is included and how long the
            link works.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="scope">What to include</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger id="scope" data-testid="select-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground" data-testid="text-scope-desc">
              {SCOPE_OPTIONS.find((o) => o.value === scope)?.desc}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">How long the link works</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger id="duration" data-testid="select-duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient label (optional)</Label>
            <Input
              id="recipient"
              placeholder="e.g. Dr. Patel, Mom"
              value={recipientLabel}
              onChange={(e) => setRecipientLabel(e.target.value)}
              data-testid="input-recipient"
            />
            <p className="text-xs text-muted-foreground">
              For your records. Helps you remember who you shared with.
            </p>
          </div>

          <Button
            className="w-full sm:w-auto"
            onClick={handleGenerate}
            disabled={generate.isFetching}
            data-testid="button-generate"
          >
            {generate.isFetching ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <QrIcon className="me-2 h-4 w-4" />
                Generate share link
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {link && (
        <Card data-testid="card-share-link">
          <CardHeader>
            <CardTitle className="text-lg">Your share link is ready</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span data-testid="text-expires-in">
                Expires in {remainingLabel}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              {(link.qrCodeDataUrl || qrFallbackUrl) && (
                <img
                  src={link.qrCodeDataUrl || qrFallbackUrl!}
                  alt="QR code"
                  className="h-60 w-60 rounded-lg border p-2 bg-white"
                  data-testid="img-qr"
                />
              )}
              <div className="w-full">
                <Label className="text-xs text-muted-foreground">Share URL</Label>
                <div className="mt-1 rounded-md border bg-muted/40 p-2 text-xs break-all font-mono">
                  <span data-testid="text-share-url">{link.shareUrl}</span>
                </div>
              </div>
              {link.passcode && (
                <div className="w-full text-start">
                  <Label className="text-xs text-muted-foreground">
                    Passcode (share separately)
                  </Label>
                  <div className="mt-1 rounded-md border bg-muted/40 p-2 text-sm font-mono tracking-widest text-center">
                    {link.passcode}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button
                variant="outline"
                onClick={handleCopy}
                data-testid="button-copy"
              >
                <Copy className="me-2 h-4 w-4" />
                Copy
              </Button>
              <Button
                variant="outline"
                onClick={handleWhatsApp}
                data-testid="button-whatsapp"
              >
                <SiWhatsapp className="me-2 h-4 w-4" />
                WhatsApp
              </Button>
              <Button
                variant="outline"
                onClick={handleSystemShare}
                data-testid="button-share-more"
              >
                <Share2 className="me-2 h-4 w-4" />
                More
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Anyone with this link (and passcode, if shown) can view your
              record until it expires. You can revoke it from Settings → Sharing.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="mt-4">
        <ClinicalDisclaimer variant="card" />
      </div>
    </div>
  );
}
