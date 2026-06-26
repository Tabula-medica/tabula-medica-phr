import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobalLanguageSwitcher } from "@/components/language-provider";
import { AIDemoTour, type AIDemoTourStep } from "@/components/ai-demo-tour";
import {
  Shield, Heart, ArrowRight, Link2, Globe, Lock,
  Search, Building2, MapPin, Loader2, ExternalLink,
  Activity, Brain, Languages, CheckCircle2,
  Network, Sparkles, GitMerge, QrCode, Mail,
  KeyRound, UserCheck, ServerCrash, Stethoscope,
  Play, Accessibility,
  Camera,
} from "lucide-react";
import { Link as WouterLink } from "wouter";
import {
  useSEO,
  buildOrganizationSchema,
  buildWebApplicationSchema,
  buildFAQSchema,
  buildHowToSchema,
  buildSiteNavigationSchema,
} from "@/hooks/use-seo";
import { ZeroKnowledgeBadge } from "@/components/zero-knowledge-badge";
const logoPath = "/logo.png";

const PRIORITY_HOSPITALS = [
  {
    name: "Inova Health System",
    baseUrl: "https://epicrpprd.inova.org/fhirrp/api/FHIR/R4/",
    region: "Northern Virginia",
  },
  {
    name: "UVA Health System",
    baseUrl: "https://hscsesoap.hscs.virginia.edu/FHIRProxy/api/FHIR/R4/",
    region: "Charlottesville, VA",
  },
  {
    name: "Sentara Healthcare",
    baseUrl: "https://epicfhir.sentara.com/ARR-FHIR-PRD/api/FHIR/R4/",
    region: "Hampton Roads, VA",
  },
  {
    name: "Healow (eClinicalWorks)",
    baseUrl: "https://fhir.healow.com/FHIRServer/fhir/R4/",
    region: "Nationwide",
  },
];

const howItWorks = [
  {
    icon: Network,
    title: "National Interoperability",
    description: "We connect to the Trusted Exchange Framework and Common Agreement (TEFCA) via Apigee, allowing you to pull records from over 70,000 healthcare sites across the country.",
  },
  {
    icon: Sparkles,
    title: "AI-Powered Summarization",
    description: "Using Med-Gemini 1.5 Pro, we transform hundreds of pages of raw clinical notes into a concise, chronological summary of your care.",
  },
  {
    icon: GitMerge,
    title: "Smart Deduplication",
    description: "Our system automatically identifies and merges duplicate lab results and imaging reports, giving you and your provider a \"noise-free\" clinical timeline.",
  },
  {
    icon: QrCode,
    title: "Point-of-Care Sharing",
    description: "Instantly share your summarized record with any provider via a secure link or QR code to avoid duplicate testing and improve safety.",
  },
];

const oauthDisclosure = [
  {
    icon: UserCheck,
    title: "Authenticate Your Identity",
    description: "We use your Google account to create a secure, private profile.",
  },
  {
    icon: KeyRound,
    title: "Authorize Access",
    description: "We only access the data you explicitly permit. We do not sell your personal or medical data to third parties.",
  },
  {
    icon: ServerCrash,
    title: "Encrypted Storage",
    description: "All clinical data processed through our Vertex AI backend is encrypted and handled according to the highest industry standards.",
  },
];

const features = [
  {
    icon: Link2,
    title: "Direct Hospital Connection",
    description: "Connect to your hospital's patient portal via SMART on FHIR. No middleman — your data flows straight to you.",
  },
  {
    icon: Shield,
    title: "HIPAA Compliant",
    description: "Enterprise-grade encryption with strict access controls and full audit logging. SOC 2 Type II audit in progress (Q2 2026).",
  },
  {
    icon: Activity,
    title: "Unified Health Records",
    description: "Labs, medications, conditions, and immunizations — all in one secure, easy-to-read place.",
  },
  {
    icon: Brain,
    title: "AI Health Insights",
    description: "Plain-language explanations of your medical data, powered by Med-Gemini with clinical audit trails.",
  },
  {
    icon: Languages,
    title: "19 Languages",
    description: "Medical terminology translated into your preferred language for better health literacy worldwide.",
  },
  {
    icon: Lock,
    title: "You Own Your Data",
    description: "Share records with providers on your terms. Revoke access anytime. Zero-knowledge encryption.",
  },
];

const trustLogos = [
  { label: "HIPAA", sublabel: "Compliant" },
  { label: "SOC 2", sublabel: "In Progress" },
  { label: "HITRUST", sublabel: "Aligned" },
  { label: "Section 508", sublabel: "Accessible" },
  { label: "WCAG 2.1 AA", sublabel: "Conformant" },
  { label: "FHIR R4", sublabel: "Certified" },
];

const landingTourSteps: AIDemoTourStep[] = [
  {
    icon: Heart,
    iconBg: "bg-rose-100 dark:bg-rose-950",
    iconColor: "text-rose-600 dark:text-rose-300",
    title: "Welcome to Tabula Medica",
    body:
      "Your complete health record — from every doctor, every hospital, every visit — in one private, easy-to-read place.",
    bullets: [
      "Built for patients, not paperwork",
      "Works on your phone, tablet, or computer",
      "Available in 19 languages",
    ],
  },
  {
    icon: Network,
    iconBg: "bg-blue-100 dark:bg-blue-950",
    iconColor: "text-blue-600 dark:text-blue-300",
    title: "Connect your records once",
    body:
      "Link your hospital portals through the national TEFCA network. We pull labs, medications, conditions, and visit notes from 70,000+ sites.",
  },
  {
    icon: Sparkles,
    iconBg: "bg-amber-100 dark:bg-amber-950",
    iconColor: "text-amber-600 dark:text-amber-300",
    title: "AI explains it in plain language",
    body:
      "Hundreds of pages of clinical notes become a short, readable timeline. Tap any medical term and we explain what it means for you.",
  },
  {
    icon: QrCode,
    iconBg: "bg-emerald-100 dark:bg-emerald-950",
    iconColor: "text-emerald-600 dark:text-emerald-300",
    title: "Share at the point of care",
    body:
      "Hand any provider a secure link or QR code with the exact slice of your record they need. Revoke access any time.",
  },
  {
    icon: Shield,
    iconBg: "bg-slate-100 dark:bg-slate-800",
    iconColor: "text-slate-700 dark:text-slate-200",
    title: "Built to keep your data safe",
    body:
      "HIPAA compliant, Section 508 and WCAG 2.1 AA accessible, audited end-to-end. You own your data and decide who sees it.",
  },
];

interface SearchResult {
  name: string;
  baseUrl: string;
  managingOrganization?: string;
}

function HospitalSearchBar() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    fetch(`/api/ehr-integration/epic/endpoints?q=${encodeURIComponent(debouncedQuery)}&limit=8`)
      .then((res) => res.json())
      .then((data) => {
        setResults(data.endpoints || []);
        setShowResults(true);
      })
      .catch(() => setResults([]))
      .finally(() => setIsSearching(false));
  }, [debouncedQuery]);

  const handleSelectHospital = (hospital: { name: string; baseUrl: string }) => {
    sessionStorage.setItem("pending_hospital_name", hospital.name);
    sessionStorage.setItem("pending_hospital_base_url", hospital.baseUrl);
    // Auth0 is OFF the patient path (no BAA) — send to GCIP sign-up.
    window.location.href = "/auth/register";
  };

  return (
    <div className="relative w-full max-w-xl">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          data-testid="input-landing-hospital-search"
          placeholder="Search 25,000+ hospitals and health systems..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          className="pl-12 pr-12 h-14 text-base rounded-xl bg-white dark:bg-slate-900 border-2 border-border/50 focus:border-primary shadow-sm"
        />
        {isSearching && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-muted-foreground" />
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-background border rounded-xl shadow-xl max-h-[320px] overflow-y-auto">
          {results.map((ep, idx) => (
            <button
              key={`${ep.baseUrl}-${idx}`}
              data-testid={`landing-search-result-${idx}`}
              className="w-full text-left px-4 py-3 hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors border-b last:border-b-0"
              onClick={() => handleSelectHospital(ep)}
            >
              <div className="flex items-start gap-3">
                <Building2 className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-foreground">{ep.name}</p>
                  {ep.managingOrganization && ep.managingOrganization !== ep.name && (
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {ep.managingOrganization}
                    </p>
                  )}
                </div>
                <ExternalLink className="h-3 w-3 mt-1 text-muted-foreground shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}

      {showResults && debouncedQuery.length >= 2 && results.length === 0 && !isSearching && (
        <div className="absolute z-50 w-full mt-2 bg-background border rounded-xl shadow-xl p-4 text-center text-sm text-muted-foreground">
          No hospitals found for "{debouncedQuery}". Try a different name.
        </div>
      )}
    </div>
  );
}

const LANDING_FAQS = [
  {
    question: "What is Tabula Medica?",
    answer: "Tabula Medica is a patient health record app that connects directly to your hospitals and clinics using SMART on FHIR. It pulls your labs, medications, conditions, and immunizations into one clean, secure timeline — no faxes, no phone calls.",
  },
  {
    question: "How much does Tabula Medica cost?",
    answer: "The Starter plan includes 1 hospital connection, a drug savings finder, clinic locator, and full timeline view. Pro ($9.99/mo) adds unlimited connections, AI health insights, and family profiles with a 14-day trial.",
  },
  {
    question: "How does Tabula Medica connect to my hospital?",
    answer: "We use SMART on FHIR and TEFCA — the same secure standards hospitals use to share data with each other. You log into your patient portal once, and your records sync automatically. No data is stored on our servers without your explicit consent.",
  },
  {
    question: "Is my health data safe?",
    answer: "Absolutely. Tabula Medica runs on HIPAA-aligned infrastructure with a SOC 2 Type II audit in progress. All data is encrypted with AES-256 at rest and TLS 1.3 in transit, with strict access controls and full audit logging. We never sell, share, or monetize your data.",
  },
  {
    question: "What if I don't have health insurance?",
    answer: "Tabula Medica includes an Uninsurance Mode that helps you find Federally Qualified Health Centers (FQHCs), compare drug prices, and access sliding-scale care. No insurance required to use any of these features.",
  },
  {
    question: "Can I share my records with my doctor?",
    answer: "Yes. With a Pro account, you can securely share specific records or your full health timeline with any provider, caregiver, or family member. Access can be revoked at any time.",
  },
];

export default function LandingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [tourOpen, setTourOpen] = useState(false);

  const landingStructuredData = useMemo(() => [
    buildOrganizationSchema(),
    buildWebApplicationSchema(),
    buildFAQSchema(LANDING_FAQS),
    buildSiteNavigationSchema(),
    buildHowToSchema({
      name: "How to Access All Your Medical Records in One App",
      description: "Connect your hospitals, clinics, and labs to Tabula Medica and view your entire health history in a unified timeline.",
      totalTime: "PT3M",
      steps: [
        { name: "Create an account", text: "Sign up for Tabula Medica. No credit card required to get started." },
        { name: "Search for your hospitals", text: "Find your healthcare providers from over 25,000 FHIR-enabled organizations across the US." },
        { name: "Log in to your patient portal", text: "Securely authenticate through your hospital's official portal (e.g., Epic MyChart) using OAuth." },
        { name: "View your unified timeline", text: "See all your labs, medications, conditions, immunizations, and procedures in one chronological view." },
        { name: "Get AI-powered insights", text: "Receive plain-language explanations of your medical data, drug savings alerts, and preventive care reminders." },
      ],
    }),
  ], []);

  useSEO({
    title: "Your Health Records, United",
    description: "Patient health record app. Connect all your hospitals into one secure, HIPAA-compliant timeline. SMART on FHIR, TEFCA, and AI-powered insights.",
    canonicalPath: "/",
    structuredData: landingStructuredData,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("auth_error");
    if (err) {
      const messages: Record<string, string> = {
        callback_failed: "Login could not be completed. Please try again or contact support if this persists.",
        no_user: "We could not retrieve your account information. Please try again.",
      };
      setAuthError(messages[err] || "An authentication error occurred. Please try again.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const navigateWithRetry = async (url: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/user", { method: "GET" });
      if (res.status === 503) {
        await new Promise((r) => setTimeout(r, 3000));
      }
    } catch {}
    window.location.href = url;
  };

  // Route everything through the GCIP-backed in-app auth pages — Auth0 is
  // OFF the patient path (no BAA with Auth0).
  const handleLogin = () => navigateWithRetry("/auth/login");
  const handleGetStarted = () => navigateWithRetry("/auth/register");

  const handleHospitalClick = (hospital: { name: string; baseUrl: string }) => {
    sessionStorage.setItem("pending_hospital_name", hospital.name);
    sessionStorage.setItem("pending_hospital_base_url", hospital.baseUrl);
    navigateWithRetry("/auth/register");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="sticky top-0 z-50 flex items-center justify-between px-5 sm:px-8 py-3.5 border-b bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
        <a href="/" className="flex items-center gap-2.5 group" data-testid="text-brand-name" aria-label="Tabula Medica — home">
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
        <div className="flex items-center gap-3 sm:gap-5">
          <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">How It Works</a>
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">Features</a>
          <a href="#privacy-oauth" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden md:inline" data-testid="link-header-privacy-oauth">Privacy</a>
          <a href="/privacy-policy" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden lg:inline" data-testid="link-header-privacy">Privacy Policy</a>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setTourOpen(true)}
            className="hidden md:inline-flex gap-1.5 text-sm"
            data-testid="button-launch-tour"
          >
            <Play className="h-3.5 w-3.5" />
            Take a tour
          </Button>
          <div className="hidden sm:block">
            <GlobalLanguageSwitcher />
          </div>
          <ThemeToggle />
          <Button onClick={handleLogin} size="sm" className="rounded-lg" data-testid="button-nav-login">
            Log In
          </Button>
        </div>
      </nav>

      <AIDemoTour
        open={tourOpen}
        onOpenChange={setTourOpen}
        steps={landingTourSteps}
        finishLabel="Sign up free"
        onFinish={() => navigateWithRetry("/auth/register")}
        ariaLabel="Tabula Medica guided tour"
      />

      {authError && (
        <div className="mx-5 sm:mx-8 mt-4 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-sm flex items-center justify-between" data-testid="alert-auth-error">
          <span>{authError}</span>
          <button onClick={() => setAuthError(null)} className="ml-4 text-destructive/60 hover:text-destructive text-lg" data-testid="button-dismiss-auth-error">&times;</button>
        </div>
      )}

      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-[#0c1a3a] to-[#072e3a]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,_rgba(37,99,235,0.15)_0%,_transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_30%,_rgba(6,182,212,0.1)_0%,_transparent_50%)]" />
        </div>

        <div className="relative max-w-5xl mx-auto px-5 sm:px-8 py-20 sm:py-28 md:py-32">
          <div className="max-w-2xl space-y-7">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] border border-white/[0.1] text-xs font-medium text-white/75">
              <Heart className="h-3.5 w-3.5 text-emerald-400" fill="currentColor" />
              Free forever for patients
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-[3.5rem] font-extrabold text-white leading-[1.06] tracking-[-0.03em]" data-testid="text-hero-heading">
              Your Health Records,{" "}
              <span className="bg-gradient-to-r from-teal-300 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
                Unified & Clear.
              </span>
            </h1>

            <p className="text-lg text-blue-100/60 leading-relaxed max-w-xl" data-testid="text-hero-description">
              Connect to 70,000+ healthcare sites. Get AI-powered summaries of your clinical history. Share securely with any provider — all in one HIPAA-compliant platform.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                className="h-[52px] px-8 text-base rounded-xl bg-gradient-to-r from-primary to-blue-500 hover:from-primary/90 hover:to-blue-500/90 text-white shadow-xl shadow-primary/35 transition-all duration-200 font-semibold"
                onClick={handleGetStarted}
                disabled={isLoading}
                data-testid="button-hero-login"
              >
                {isLoading ? "Connecting..." : "Get Started"}
                {isLoading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-[52px] px-8 text-base rounded-xl bg-white/[0.04] hover:bg-white/[0.1] text-white border-white/[0.12] w-full sm:w-auto transition-all duration-200"
                data-testid="button-hero-learn-more"
              >
                <a href="#find-hospital" aria-label="Find your hospital among 70,000+ supported sites">
                  <Search className="mr-2 h-4 w-4" />
                  Find Your Hospital
                </a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-[52px] px-8 text-base rounded-xl bg-white/[0.04] hover:bg-white/[0.1] text-white border-white/[0.12] w-full sm:w-auto transition-all duration-200"
                data-testid="button-hero-symptom-checker"
              >
                <WouterLink href="/symptom-checker" aria-label="Try the AI symptom checker">
                  <Stethoscope className="mr-2 h-4 w-4" />
                  Try Symptom Checker
                </WouterLink>
              </Button>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {[
                "No credit card",
                "HIPAA compliant",
                "Available worldwide",
              ].map((item) => (
                <span key={item} className="flex items-center gap-1.5 text-[13px] text-slate-400/60">
                  <CheckCircle2 className="h-3.5 w-3.5 text-teal-400/50" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="border-b border-border/50 bg-gradient-to-r from-muted/30 via-muted/50 to-muted/30 dark:from-muted/10 dark:via-muted/20 dark:to-muted/10">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-5">
          <div className="flex items-center justify-center gap-8 sm:gap-14">
            {trustLogos.map((item) => (
              <div key={item.label} className="text-center group">
                <p className="text-sm font-bold text-foreground tracking-wide group-hover:text-primary transition-colors">{item.label}</p>
                <p className="text-[11px] text-muted-foreground">{item.sublabel}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section id="how-it-works" className="border-b">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-14 sm:py-20">
          <div className="text-center space-y-3 mb-12">
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-foreground" data-testid="text-how-it-works-heading">
              How Tabula Medica Works
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto" data-testid="text-how-it-works-description">
              Our application provides a secure interface for patients to interact with their own health data through the following core features:
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5 max-w-4xl mx-auto">
            {howItWorks.map((item, idx) => (
              <div
                key={item.title}
                className="group p-6 rounded-2xl border border-border/40 bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
                data-testid={`card-how-it-works-${idx}`}
              >
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 shrink-0 rounded-xl bg-gradient-to-br from-primary/10 to-accent/5 dark:from-primary/20 dark:to-accent/10 flex items-center justify-center group-hover:from-primary/15 group-hover:to-accent/10 transition-all duration-300">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-primary/60 tracking-[0.08em] uppercase mb-1">Step {String(idx + 1).padStart(2, '0')}</div>
                    <h3 className="font-bold text-foreground mb-1.5">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="privacy-oauth" className="border-b bg-primary/3 dark:bg-primary/5">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-14 sm:py-20">
          <div className="text-center space-y-3 mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/8 dark:bg-primary/15 text-xs font-medium text-primary mx-auto">
              <Shield className="h-3.5 w-3.5" />
              Privacy & Security
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-foreground" data-testid="text-oauth-heading">
              Privacy & Security (OAuth Disclosure)
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto" data-testid="text-oauth-description">
              Tabula Medica takes your data privacy seriously. To provide these services, we use Google OAuth to:
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto mb-10">
            {oauthDisclosure.map((item, idx) => (
              <div
                key={item.title}
                className="p-6 rounded-2xl border border-border/40 bg-card text-center"
                data-testid={`card-oauth-${idx}`}
              >
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="max-w-3xl mx-auto p-5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50" data-testid="notice-no-medical-advice">
            <p className="text-sm text-amber-800 dark:text-amber-200 text-center leading-relaxed">
              <strong>Important:</strong> This application is a supportive tool and does not provide medical diagnoses. Always consult with a qualified healthcare professional for medical advice.
            </p>
          </div>
        </div>
      </section>

      <section id="find-hospital" className="border-b">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-14 sm:py-20">
          <div className="text-center space-y-3 mb-10">
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-foreground" data-testid="text-hospital-search-heading">
              Connect to Your Hospital
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto" data-testid="text-hospital-search-description">
              Search thousands of Epic-connected hospitals or select a health system below.
            </p>
          </div>

          <div className="flex justify-center mb-10">
            <HospitalSearchBar />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {PRIORITY_HOSPITALS.map((hospital) => (
              <button
                key={hospital.name}
                data-testid={`button-priority-hospital-${hospital.name.toLowerCase().replace(/\s+/g, '-')}`}
                className="text-left p-5 rounded-xl bg-card border border-border/60 hover:border-primary/40 hover:shadow-md transition-all group"
                onClick={() => handleHospitalClick(hospital)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/8 dark:bg-primary/15 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground leading-snug">{hospital.name}</p>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {hospital.region}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Connect via MyChart
                  <ArrowRight className="h-3 w-3" />
                </div>
              </button>
            ))}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-8">
            Powered by SMART on FHIR — the healthcare industry standard for secure data access
          </p>
        </div>
      </section>

      <section id="features" className="border-b">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-14 sm:py-20">
          <div className="text-center space-y-3 mb-12">
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-foreground" data-testid="text-features-heading">
              Everything You Need
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto" data-testid="text-features-description">
              One secure platform to access, understand, and share your complete medical history.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group p-6 rounded-2xl border border-border/40 bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
                data-testid={`card-feature-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 flex items-center justify-center mb-4 group-hover:from-primary/15 group-hover:to-primary/10 transition-all duration-300">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-14 sm:py-20">
          <div className="text-center space-y-3 mb-8">
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-foreground" data-testid="text-privacy-heading">
              Privacy That's Provable, Not Promised
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Your health data is encrypted on your device before it ever reaches our servers. We literally cannot read your records.
            </p>
          </div>
          <ZeroKnowledgeBadge variant="full" className="max-w-lg mx-auto" />
          <div className="mt-8 text-center">
            <a href="/try">
              <Button variant="outline" className="gap-2" data-testid="button-try-privacy">
                <Camera className="h-4 w-4" />
                See it in action — upload a document privately
              </Button>
            </a>
          </div>
        </div>
      </section>

      <section className="border-b bg-primary/3 dark:bg-primary/5">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-14 sm:py-20">
          <div className="flex flex-col md:flex-row items-center gap-10">
            <div className="flex-1 space-y-5">
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-foreground" data-testid="text-fasten-heading">
                25,000+ Providers Connected
              </h2>
              <p className="text-muted-foreground leading-relaxed" data-testid="text-fasten-description">
                Can't find your hospital? Fasten Health connects you to thousands of additional US healthcare providers including non-Epic systems. All your records flow securely into Tabula Medica.
              </p>
              <a href="#find-hospital">
                <Button size="lg" variant="outline" className="rounded-xl" data-testid="button-fasten-connect">
                  <Link2 className="mr-2 h-4 w-4" />
                  Search Providers
                </Button>
              </a>
            </div>
            <div className="flex-shrink-0 grid grid-cols-3 gap-4">
              {[
                { value: "25K+", label: "Providers" },
                { value: "FHIR", label: "Standard" },
                { value: "HIPAA", label: "Compliant" },
              ].map((stat) => (
                <div key={stat.label} className="p-5 rounded-xl bg-card border border-border/60 text-center min-w-[90px]" data-testid={`stat-${stat.label.toLowerCase()}`}>
                  <p className="text-2xl font-bold text-primary">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-muted/20" id="faq">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-foreground text-center mb-2" data-testid="text-faq-heading">
            Frequently Asked Questions
          </h2>
          <p className="text-muted-foreground text-center mb-8 max-w-lg mx-auto">
            Everything you need to know about managing your health records with Tabula Medica.
          </p>
          <div className="space-y-3">
            {LANDING_FAQS.map((faq, idx) => (
              <details
                key={idx}
                className="group bg-card border border-border/60 rounded-xl overflow-hidden"
                data-testid={`faq-item-${idx}`}
              >
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none text-sm sm:text-base font-medium text-foreground hover:bg-muted/50 transition-colors list-none">
                  <span>{faq.question}</span>
                  <svg className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                </summary>
                <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed" data-testid={`faq-answer-${idx}`}>
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
          <div className="text-center mt-8">
            <a href="/faq" className="text-primary text-sm font-medium hover:underline" data-testid="link-full-faq">
              View all frequently asked questions &rarr;
            </a>
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-b from-background to-muted/30">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-16 sm:py-24 text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-foreground" data-testid="text-cta-heading">
            Your Records. Your Control.
          </h2>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto">
            One secure place for your complete health story — labs, medications, conditions, and more.
          </p>
        </div>
      </section>

      <section className="border-t bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/10">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
          <div className="flex flex-col md:flex-row items-center gap-10">
            <div className="flex-1 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-200/60 dark:bg-amber-800/30 text-amber-800 dark:text-amber-300 text-xs font-semibold tracking-wide uppercase" data-testid="badge-uninsurance">
                Uninsurance Mode
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-foreground" data-testid="text-uninsurance-heading">
                No Insurance? <span className="text-amber-600 dark:text-amber-400 italic">No Problem.</span>
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Tabula Medica's Uninsurance Mode helps you find affordable care at FQHC community health centers, compare transparent cash-pay rates, and track savings — all without an insurance card.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" /> HRSA clinic finder with sliding-scale pricing</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" /> Cash-pay rate comparison (save 40-70%)</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" /> Savings calculator vs. traditional insurance</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" /> AI health assistant in 6 languages</li>
              </ul>
              <a
                href="/uninsurance.html"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-600 text-white font-semibold text-sm hover:bg-amber-700 transition-all shadow-md shadow-amber-600/20"
                data-testid="link-uninsurance-learn-more"
              >
                Learn More
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
            <div className="flex-shrink-0 w-64 h-40 rounded-2xl bg-gradient-to-br from-amber-600/20 to-teal-600/20 dark:from-amber-400/10 dark:to-teal-400/10 border border-amber-300/40 dark:border-amber-700/30 flex items-center justify-content-center p-6">
              <div className="text-center w-full space-y-2">
                <div className="text-4xl">💛</div>
                <p className="text-sm font-bold text-foreground">28M+ Uninsured</p>
                <p className="text-xs text-muted-foreground">Americans deserve affordable care</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="legal" className="border-t bg-muted/20 dark:bg-muted/5">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-12 text-center space-y-6">
          <h2 className="text-xl font-serif font-bold text-foreground" data-testid="text-legal-heading">
            Legal & Compliance
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <a
              href="/privacy-policy"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-card border border-border/60 text-sm font-medium text-foreground hover:border-primary/40 hover:shadow-md transition-all"
              data-testid="link-legal-privacy"
            >
              <Shield className="h-4 w-4 text-primary" />
              Privacy Policy
            </a>
            <a
              href="/terms-of-service"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-card border border-border/60 text-sm font-medium text-foreground hover:border-primary/40 hover:shadow-md transition-all"
              data-testid="link-legal-terms"
            >
              <Globe className="h-4 w-4 text-primary" />
              Terms of Service
            </a>
            <a
              href="mailto:support@infotabula.digital"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-card border border-border/60 text-sm font-medium text-foreground hover:border-primary/40 hover:shadow-md transition-all"
              data-testid="link-legal-contact"
            >
              <Mail className="h-4 w-4 text-primary" />
              Contact Support
            </a>
          </div>
        </div>
      </section>

      <div className="mt-auto border-t">
        <footer className="max-w-5xl mx-auto px-5 sm:px-8 py-8 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={logoPath} alt="" className="h-5 w-5 opacity-50" />
            <span data-testid="text-copyright">&copy; {new Date().getFullYear()} Tabula Medica</span>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <a href="/privacy-policy" className="hover:text-foreground transition-colors" data-testid="link-privacy">Privacy</a>
            <a href="/terms-of-service" className="hover:text-foreground transition-colors" data-testid="link-terms">Terms</a>
            <a href="/about/security" className="hover:text-foreground transition-colors" data-testid="link-security">Security</a>
            <a href="mailto:support@infotabula.digital" className="hover:text-foreground transition-colors" data-testid="link-contact">Contact</a>
            <GlobalLanguageSwitcher />
          </div>
        </footer>
      </div>
    </div>
  );
}
