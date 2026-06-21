import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocumentScanner } from "@/components/document-scanner";
import { ZeroKnowledgeBadge, PrivacyFirstIndicator } from "@/components/zero-knowledge-badge";
import { useSEO, buildWebApplicationSchema, buildMedicalWebPageSchema, buildHowToSchema } from "@/hooks/use-seo";
import {
  ArrowRight, Shield, Sparkles, CheckCircle2, Lock,
  FileText, Clock, User, Zap,
} from "lucide-react";

const logoPath = "/logo.png";

export default function InstantAnalysisPage() {
  const [hasResult, setHasResult] = useState(false);
  const [step, setStep] = useState<"scan" | "result" | "signup">("scan");

  const structuredData = useMemo(() => [
    buildWebApplicationSchema(),
    buildHowToSchema({
      name: "How to Scan and Digitize a Medical Document",
      description: "Use AI-powered OCR to extract structured data from a photo of any medical document — bills, lab results, prescriptions, or insurance cards.",
      totalTime: "PT30S",
      steps: [
        { name: "Choose your document type", text: "Select what kind of document you have: hospital bill, lab result, prescription, or insurance card." },
        { name: "Upload or photograph the document", text: "Drag and drop a file, upload from your device, or take a photo with your camera." },
        { name: "Review AI-extracted data", text: "The AI extracts key fields — dates, amounts, medications, test results — and organizes them into structured, searchable data." },
      ],
    }),
    buildMedicalWebPageSchema({
      name: "Try Tabula Medica — Instant Document Analysis",
      description: "Upload a medical bill, lab result, or prescription. See AI-powered analysis instantly — no account required.",
      path: "/try",
      medicalAudience: "Patient",
    }),
  ], []);

  useSEO({
    title: "Try It — Instant Medical Document Analysis",
    description: "Upload a medical bill, lab result, or prescription. See AI-powered analysis instantly — no account required. Zero-knowledge encrypted.",
    canonicalPath: "/try",
    structuredData,
  });

  const handleResult = () => {
    setHasResult(true);
    setStep("result");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="sticky top-0 z-50 flex items-center justify-between px-5 sm:px-8 py-3.5 border-b bg-background/80 backdrop-blur-lg">
        <a href="/" className="flex items-center gap-2">
          <img src={logoPath} alt="Tabula Medica" className="h-7 w-7" />
          <span className="font-semibold text-foreground text-lg tracking-tight">Tabula Medica</span>
        </a>
        <div className="flex items-center gap-3">
          <ZeroKnowledgeBadge variant="compact" />
          <a href="/api/login">
            <Button variant="outline" size="sm" data-testid="button-login">Sign In</Button>
          </a>
        </div>
      </nav>

      <div className="flex-1 max-w-4xl mx-auto px-5 sm:px-8 py-8 sm:py-12 w-full">
        <div className="text-center mb-8">
          <Badge variant="secondary" className="mb-4 text-xs" data-testid="badge-no-account">
            <Zap className="h-3 w-3 mr-1" />
            No account required
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-foreground mb-3" data-testid="text-try-heading">
            See Your Data Come Alive
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Upload a medical bill, lab result, or prescription. Our AI extracts structured data in seconds — completely private.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <DocumentScanner anonymous onResult={handleResult} />
          </div>

          <div className="lg:col-span-2 space-y-4">
            {!hasResult ? (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      How It Works
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { step: "1", title: "Snap or Upload", desc: "Take a photo of any medical document", icon: FileText },
                      { step: "2", title: "AI Extracts", desc: "Gemma 4 OCR reads and structures the data", icon: Sparkles },
                      { step: "3", title: "See the Reasoning", desc: "Transparent AI — see exactly how it parsed", icon: CheckCircle2 },
                    ].map((item) => (
                      <div key={item.step} className="flex items-start gap-3">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                          {item.step}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <ZeroKnowledgeBadge variant="full" />
              </>
            ) : (
              <Card className="border-primary/30 bg-primary/[0.02]" data-testid="card-signup-prompt">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-primary">
                    <CheckCircle2 className="h-4 w-4" />
                    Your Data, Structured
                  </CardTitle>
                  <CardDescription>
                    That was just one document. Imagine all your hospital records, unified and searchable.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {[
                      "Connect to 25,000+ hospitals automatically",
                      "AI-powered health timeline and insights",
                      "Drug savings finder — save up to 80%",
                      "Share securely with any provider",
                      "19 languages, fully accessible",
                    ].map((feature) => (
                      <div key={feature} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  <a href="/api/login" className="block">
                    <Button className="w-full gap-2" size="lg" data-testid="button-create-account">
                      Create Account
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </a>

                  <div className="flex items-center gap-3 justify-center">
                    <PrivacyFirstIndicator className="justify-center" />
                  </div>

                  <p className="text-[11px] text-muted-foreground text-center">
                    1 hospital connection included. No credit card required.
                  </p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Lock className="h-3 w-3" />
                    <span>This document is processed in-memory and never stored.</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground mb-2">What is your primary health goal?</p>
          <div className="flex flex-wrap justify-center gap-2" data-testid="health-goals">
            {[
              "Organize my records",
              "Understand my lab results",
              "Find cheaper prescriptions",
              "Share with my doctor",
              "Track a chronic condition",
              "Manage family health",
            ].map((goal) => (
              <button
                key={goal}
                className="px-3 py-1.5 rounded-full text-xs font-medium border bg-card hover:bg-primary/5 hover:border-primary/30 transition-colors"
                data-testid={`button-goal-${goal.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={() => {
                  sessionStorage.setItem("health_goal", goal);
                  window.location.href = "/api/login";
                }}
              >
                {goal}
              </button>
            ))}
          </div>
        </div>
      </div>

      <footer className="border-t py-6 px-5 sm:px-8">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={logoPath} alt="" className="h-4 w-4 opacity-50" />
            <span>&copy; {new Date().getFullYear()} Tabula Medica</span>
          </div>
          <div className="flex gap-4">
            <a href="/privacy-policy" className="hover:text-foreground transition-colors" data-testid="link-try-privacy">Privacy</a>
            <a href="/terms-of-service" className="hover:text-foreground transition-colors" data-testid="link-try-terms">Terms</a>
            <a href="/faq" className="hover:text-foreground transition-colors" data-testid="link-try-faq">FAQ</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
