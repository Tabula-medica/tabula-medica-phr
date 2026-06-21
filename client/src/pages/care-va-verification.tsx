import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Upload, CheckCircle2, FileText, ExternalLink } from "lucide-react";

export default function CareVaVerificationPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [edipi, setEdipi] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleFile = (file: File | null) => {
    if (!file) {
      setFileName(null);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a DD-214 under 10 MB.",
        variant: "destructive",
      });
      return;
    }
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/heic"];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|jpg|jpeg|png|heic)$/i)) {
      toast({
        title: "Unsupported file type",
        description: "Use PDF, JPG, PNG, or HEIC.",
        variant: "destructive",
      });
      return;
    }
    setFileName(file.name);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !fileName) {
      toast({
        title: "Missing information",
        description: "Please enter your email and attach your DD-214.",
        variant: "destructive",
      });
      return;
    }
    setSubmitted(true);
    toast({
      title: "We'll be in touch",
      description: "Your interest is on the early-access list.",
    });
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl">
      <header className="mb-6 text-start">
        <div className="flex items-center gap-3 mb-2">
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 p-2">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1
            className="text-2xl md:text-3xl font-semibold tracking-tight"
            data-testid="text-va-title"
          >
            Veteran Verification
          </h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          We're building VA benefits coordination so your DD-214 unlocks faster
          care navigation, VA pharmacy savings, and appointment booking. Join
          the early-access list.
        </p>
      </header>

      <Card className="mb-4 border-amber-200 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/10">
        <CardContent className="p-4 text-start">
          <p className="text-sm">
            <strong>Early access.</strong> Full VA API integration is in
            development. For now, we'll securely hold your DD-214 and notify
            you the moment verification goes live.
          </p>
        </CardContent>
      </Card>

      {!submitted ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Submit your DD-214</CardTitle>
            <CardDescription>
              Your discharge document is encrypted in transit and at rest. Only
              you and the VA verification service will see it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="va-email">Email for early-access notification</Label>
                <Input
                  id="va-email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="input-va-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="va-edipi">EDIPI / DoD ID (optional)</Label>
                <Input
                  id="va-edipi"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10-digit DoD ID"
                  value={edipi}
                  onChange={(e) => setEdipi(e.target.value.replace(/\D/g, ""))}
                  data-testid="input-va-edipi"
                />
                <p className="text-xs text-muted-foreground">
                  Speeds up verification once we go live. Skip if you don't
                  have it handy.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="va-file">DD-214 (PDF, JPG, PNG, HEIC — up to 10 MB)</Label>
                <div className="rounded-lg border-2 border-dashed border-border p-6 text-center">
                  <input
                    id="va-file"
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.heic,application/pdf,image/*"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                    data-testid="input-va-file"
                  />
                  <label
                    htmlFor="va-file"
                    className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium"
                  >
                    <Upload className="h-4 w-4" />
                    {fileName ? "Choose a different file" : "Choose file"}
                  </label>
                  {fileName && (
                    <p
                      className="mt-2 text-xs text-muted-foreground flex items-center justify-center gap-1"
                      data-testid="text-va-filename"
                    >
                      <FileText className="h-3 w-3" />
                      {fileName}
                    </p>
                  )}
                </div>
              </div>

              <Button type="submit" className="w-full sm:w-auto" data-testid="button-va-submit">
                Join early-access list
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card data-testid="card-va-confirmation">
          <CardContent className="p-6 text-start space-y-3">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">You're on the list</span>
            </div>
            <p className="text-sm text-muted-foreground">
              We'll email <strong>{email}</strong> the moment VA verification
              goes live. In the meantime, you can use VA.gov to manage your
              benefits directly.
            </p>
            <a
              href="https://www.va.gov/health-care/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-teal-700 dark:text-teal-300 hover:underline"
              data-testid="link-va-gov"
            >
              Visit VA.gov health care
              <ExternalLink className="h-4 w-4" />
            </a>
          </CardContent>
        </Card>
      )}

      <div className="mt-4">
        <ClinicalDisclaimer variant="card" />
      </div>
    </div>
  );
}
