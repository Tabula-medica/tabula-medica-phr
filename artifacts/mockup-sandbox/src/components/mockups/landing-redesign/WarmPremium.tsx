import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Shield, Heart, ArrowRight, Link2, Lock,
  Search, Building2, MapPin, Loader2, ExternalLink,
  Activity, Brain, Languages, CheckCircle2,
  Network, Sparkles, GitMerge, QrCode,
  KeyRound, UserCheck, ServerCrash, 
  Stethoscope, Globe, Mail
} from "lucide-react";

const logoPath = "/logo.png";
const heroImage = "/__mockup/images/warm-hero.png";

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
    title: "HIPAA & SOC 2 Compliant",
    description: "Enterprise-grade encryption with strict access controls and full audit logging.",
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
  { label: "SOC 2", sublabel: "Type II" },
  { label: "FHIR R4", sublabel: "Certified" },
  { label: "SMART", sublabel: "on FHIR" },
];

interface SearchResult {
  name: string;
  baseUrl: string;
  managingOrganization?: string;
}

function HospitalSearchBar() {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="relative flex items-center">
        <Search className="absolute left-5 h-5 w-5 text-amber-900/40" />
        <Input
          data-testid="input-landing-hospital-search"
          placeholder="Search 25,000+ hospitals and health systems..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-14 pr-14 h-16 text-lg rounded-2xl bg-[#FDFBF7] border-2 border-amber-900/10 focus:border-amber-600/40 focus:ring-amber-600/20 shadow-sm transition-all text-slate-800 placeholder:text-slate-400"
        />
        {isSearching && (
          <Loader2 className="absolute right-5 h-5 w-5 animate-spin text-amber-600" />
        )}
      </div>
    </div>
  );
}

export default function WarmPremium() {
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-slate-800 font-sans selection:bg-amber-100 selection:text-amber-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 sm:px-10 py-4 bg-[#FDFBF7]/90 backdrop-blur-xl border-b border-amber-900/5">
        <div className="flex items-center gap-3 cursor-pointer" data-testid="text-brand-name">
          <div className="h-10 w-10 bg-gradient-to-br from-indigo-900 to-slate-900 rounded-xl flex items-center justify-center shadow-md border border-indigo-800">
             <Stethoscope className="h-5 w-5 text-amber-200" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">Tabula Medica</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#how-it-works" className="text-sm font-medium text-slate-600 hover:text-amber-700 transition-colors hidden sm:block">How It Works</a>
          <a href="#features" className="text-sm font-medium text-slate-600 hover:text-amber-700 transition-colors hidden sm:block">Features</a>
          <a href="#privacy" className="text-sm font-medium text-slate-600 hover:text-amber-700 transition-colors hidden md:block" data-testid="link-header-privacy-oauth">Privacy</a>
          <Button 
            onClick={handleAction} 
            className="rounded-full bg-slate-900 hover:bg-slate-800 text-amber-50 px-6 font-medium shadow-md transition-all" 
            data-testid="button-nav-login"
          >
            Log In
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0">
          <img src={heroImage} alt="Premium Abstract Background" className="w-full h-full object-cover opacity-80 mix-blend-overlay" />
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/60 via-slate-950/80 to-slate-950" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 sm:px-10 py-24 sm:py-32 lg:py-40">
          <div className="max-w-3xl space-y-10">
            <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 backdrop-blur-md">
              <Heart className="h-4 w-4 text-amber-400 fill-amber-400/20" />
              <span className="text-sm font-medium text-amber-200 tracking-wide uppercase">Free forever for patients</span>
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-7xl font-serif font-medium text-[#FDFBF7] leading-[1.1]" data-testid="text-hero-heading">
              Your Clinical History,<br/>
              <span className="text-amber-200/90 italic">Unified and Simplified.</span>
            </h1>

            <p className="text-xl sm:text-2xl text-slate-300 leading-relaxed max-w-2xl font-light" data-testid="text-hero-description">
              Tabula Medica is a secure, patient-facing platform designed to solve the problem of fragmented medical data. By leveraging the national TEFCA network and advanced AI, we empower patients to own their "Palm Record" — a deduplicated, summarized, and shareable clinical history.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button
                size="lg"
                className="h-14 px-8 text-lg rounded-full bg-amber-600 hover:bg-amber-500 text-white shadow-xl shadow-amber-900/20 transition-all duration-300 border-none"
                onClick={handleAction}
                disabled={isLoading}
                data-testid="button-hero-login"
              >
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Get Started Free
                {!isLoading && <ArrowRight className="ml-2 h-5 w-5" />}
              </Button>
              <a href="#how-it-works" className="block w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 px-8 text-lg rounded-full bg-white/5 hover:bg-white/10 text-white border-white/20 backdrop-blur-md w-full transition-all duration-300"
                  data-testid="button-hero-learn-more"
                >
                  <Search className="mr-2 h-5 w-5 opacity-70" />
                  Learn How It Works
                </Button>
              </a>
            </div>

            <div className="flex flex-wrap gap-x-8 gap-y-3 pt-6 border-t border-white/10">
              {["No credit card required", "HIPAA compliant", "Available worldwide"].map((item) => (
                <span key={item} className="flex items-center gap-2 text-sm font-medium text-slate-400">
                  <CheckCircle2 className="h-4 w-4 text-amber-500/70" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trust Logos */}
      <div className="border-b border-amber-900/5 bg-[#F9F7F1]">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-8">
          <div className="flex flex-wrap items-center justify-center gap-12 sm:gap-20 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
            {trustLogos.map((item) => (
              <div key={item.label} className="text-center group">
                <p className="text-lg font-serif font-bold text-slate-800 tracking-wider group-hover:text-amber-800 transition-colors">{item.label}</p>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mt-1">{item.sublabel}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 sm:py-32 bg-[#FDFBF7]">
        <div className="max-w-6xl mx-auto px-6 sm:px-10">
          <div className="text-center space-y-4 mb-20">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-medium text-slate-900" data-testid="text-how-it-works-heading">
              How Tabula Medica Works
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto font-light" data-testid="text-how-it-works-description">
              Our application provides a secure interface for patients to interact with their own health data through the following core features:
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {howItWorks.map((item, idx) => (
              <div
                key={item.title}
                className="group p-8 sm:p-10 rounded-3xl bg-white border border-amber-900/5 hover:border-amber-900/20 shadow-sm hover:shadow-xl hover:shadow-amber-900/5 transition-all duration-500"
                data-testid={`card-how-it-works-${idx}`}
              >
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  <div className="h-16 w-16 shrink-0 rounded-2xl bg-[#F9F7F1] flex items-center justify-center group-hover:scale-110 group-hover:bg-amber-50 transition-all duration-500">
                    <item.icon className="h-8 w-8 text-amber-700" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-xl font-serif font-medium text-slate-900 mb-3">{item.title}</h3>
                    <p className="text-slate-600 leading-relaxed font-light">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy & Security */}
      <section id="privacy" className="py-24 sm:py-32 bg-[#F9F7F1] border-y border-amber-900/5">
        <div className="max-w-6xl mx-auto px-6 sm:px-10">
          <div className="text-center space-y-4 mb-20">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-slate-900 text-amber-400 mb-4">
              <Shield className="h-8 w-8" strokeWidth={1.5} />
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-medium text-slate-900" data-testid="text-oauth-heading">
              Privacy & Security (OAuth Disclosure)
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto font-light" data-testid="text-oauth-description">
              Tabula Medica takes your data privacy seriously. To provide these services, we use Google OAuth to:
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {oauthDisclosure.map((item, idx) => (
              <div
                key={item.title}
                className="p-8 rounded-3xl bg-white border border-amber-900/5 text-center shadow-sm"
                data-testid={`card-oauth-${idx}`}
              >
                <div className="h-14 w-14 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-6">
                  <item.icon className="h-6 w-6 text-slate-800" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-serif font-medium text-slate-900 mb-3">{item.title}</h3>
                <p className="text-slate-600 leading-relaxed font-light">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="max-w-3xl mx-auto p-8 rounded-3xl bg-amber-50/50 border border-amber-200/60 shadow-sm" data-testid="notice-no-medical-advice">
            <div className="flex gap-4">
              <div className="shrink-0 mt-1">
                <div className="h-8 w-8 rounded-full bg-amber-200/50 flex items-center justify-center">
                  <Stethoscope className="h-4 w-4 text-amber-800" strokeWidth={2} />
                </div>
              </div>
              <p className="text-amber-900/80 leading-relaxed font-light">
                <strong className="font-medium text-amber-900">Important:</strong> This application is a supportive tool and does not provide medical diagnoses. Always consult with a qualified healthcare professional for medical advice.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Hospital Search */}
      <section id="find-hospital" className="py-24 sm:py-32 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-900 to-slate-900"></div>
        <div className="max-w-6xl mx-auto px-6 sm:px-10 relative z-10">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-medium text-amber-50" data-testid="text-hospital-search-heading">
              Connect to Your Hospital
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto font-light" data-testid="text-hospital-search-description">
              Search thousands of Epic-connected hospitals or select a priority health system below.
            </p>
          </div>

          <div className="mb-16">
            <HospitalSearchBar />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {PRIORITY_HOSPITALS.map((hospital) => (
              <button
                key={hospital.name}
                data-testid={`button-priority-hospital-${hospital.name.toLowerCase().replace(/\s+/g, '-')}`}
                className="text-left p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-amber-500/30 transition-all duration-300 group"
                onClick={handleAction}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300 mb-5 group-hover:scale-110 transition-transform duration-500">
                  <Building2 className="h-6 w-6" strokeWidth={1.5} />
                </div>
                <p className="font-serif text-lg font-medium text-white mb-2">{hospital.name}</p>
                <p className="text-sm text-slate-400 flex items-center gap-1.5 font-light">
                  <MapPin className="h-3.5 w-3.5 text-amber-500/70" />
                  {hospital.region}
                </p>
              </button>
            ))}
          </div>

          <p className="text-center text-sm text-slate-500 mt-16 font-light">
            Powered by SMART on FHIR — the healthcare industry standard for secure data access
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 sm:py-32 bg-[#FDFBF7]">
        <div className="max-w-6xl mx-auto px-6 sm:px-10">
          <div className="text-center space-y-4 mb-20">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-medium text-slate-900" data-testid="text-features-heading">
              Everything You Need
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto font-light" data-testid="text-features-description">
              One secure platform to access, understand, and share your complete medical history.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group"
                data-testid={`card-feature-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="h-14 w-14 rounded-2xl bg-indigo-900/5 text-indigo-900 flex items-center justify-center mb-6 group-hover:bg-amber-600 group-hover:text-white transition-colors duration-300">
                  <feature.icon className="h-6 w-6" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-serif font-medium text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed font-light">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Providers Connected (Fasten) */}
      <section className="py-20 sm:py-28 bg-amber-50/50 border-y border-amber-900/5">
        <div className="max-w-6xl mx-auto px-6 sm:px-10">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            <div className="flex-1 space-y-6">
              <h2 className="text-3xl sm:text-4xl font-serif font-medium text-slate-900" data-testid="text-fasten-heading">
                25,000+ Providers Connected
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed font-light" data-testid="text-fasten-description">
                Can't find your hospital? Fasten Health connects you to thousands of additional US healthcare providers including non-Epic systems. All your records flow securely into Tabula Medica.
              </p>
              <Button size="lg" className="h-14 px-8 rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-md transition-all" onClick={handleAction} data-testid="button-fasten-connect">
                <Link2 className="mr-2 h-5 w-5" />
                Connect Your Records
              </Button>
            </div>
            <div className="flex-shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-6 w-full lg:w-auto">
              {[
                { value: "25K+", label: "Providers" },
                { value: "FHIR", label: "Standard" },
                { value: "HIPAA", label: "Compliant" },
              ].map((stat) => (
                <div key={stat.label} className="p-8 rounded-3xl bg-white border border-amber-900/5 text-center shadow-sm" data-testid={`stat-${stat.label.toLowerCase()}`}>
                  <p className="text-4xl font-serif font-medium text-amber-700">{stat.value}</p>
                  <p className="text-sm text-slate-500 mt-2 font-medium tracking-wide uppercase">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 sm:py-32 bg-white text-center">
        <div className="max-w-4xl mx-auto px-6 sm:px-10">
          <h2 className="text-4xl sm:text-5xl font-serif font-medium text-slate-900 mb-6" data-testid="text-cta-heading">
            Take Control of Your Health Data
          </h2>
          <p className="text-xl text-slate-600 mb-12 font-light max-w-2xl mx-auto">
            Join thousands of patients who have already unified their medical records into a single, secure source of truth. Free, forever.
          </p>
          <Button
            size="lg"
            className="h-16 px-10 text-lg rounded-full bg-amber-600 hover:bg-amber-500 text-white shadow-xl shadow-amber-900/20 transition-all duration-300"
            onClick={handleAction}
            data-testid="button-cta-signup"
          >
            Create Your Free Account
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Legal & Compliance Section */}
      <section id="legal" className="py-16 bg-[#F9F7F1] border-t border-amber-900/5">
        <div className="max-w-4xl mx-auto px-6 sm:px-10 text-center space-y-8">
          <h2 className="text-2xl font-serif font-medium text-slate-900" data-testid="text-legal-heading">
            Legal & Compliance
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <a
              href="#"
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white border border-amber-900/10 text-sm font-medium text-slate-700 hover:border-amber-500/30 hover:shadow-md transition-all"
              data-testid="link-legal-privacy"
            >
              <Shield className="h-4 w-4 text-amber-600" />
              Privacy Policy
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white border border-amber-900/10 text-sm font-medium text-slate-700 hover:border-amber-500/30 hover:shadow-md transition-all"
              data-testid="link-legal-terms"
            >
              <Globe className="h-4 w-4 text-amber-600" />
              Terms of Service
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white border border-amber-900/10 text-sm font-medium text-slate-700 hover:border-amber-500/30 hover:shadow-md transition-all"
              data-testid="link-legal-contact"
            >
              <Mail className="h-4 w-4 text-amber-600" />
              Contact Support
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 pt-20 pb-10 border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 sm:px-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="md:col-span-2 space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
                   <Stethoscope className="h-4 w-4 text-amber-400" />
                </div>
                <span className="text-xl font-bold tracking-tight text-white">Tabula Medica</span>
              </div>
              <p className="text-slate-400 max-w-sm font-light leading-relaxed">
                Empowering patients with unified, understandable, and secure access to their complete medical history.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium text-white mb-6">Platform</h4>
              <ul className="space-y-4 font-light">
                <li><a href="#how-it-works" className="text-slate-400 hover:text-amber-400 transition-colors">How it Works</a></li>
                <li><a href="#features" className="text-slate-400 hover:text-amber-400 transition-colors">Features</a></li>
                <li><a href="#find-hospital" className="text-slate-400 hover:text-amber-400 transition-colors">Find Hospital</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-white mb-6">Legal</h4>
              <ul className="space-y-4 font-light">
                <li><a href="#" className="text-slate-400 hover:text-amber-400 transition-colors" data-testid="link-privacy">Privacy Policy</a></li>
                <li><a href="#" className="text-slate-400 hover:text-amber-400 transition-colors" data-testid="link-terms">Terms of Service</a></li>
                <li><a href="#privacy" className="text-slate-400 hover:text-amber-400 transition-colors" data-testid="link-security">Security Details</a></li>
                <li><a href="#" className="text-slate-400 hover:text-amber-400 transition-colors" data-testid="link-contact">Contact</a></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-slate-500 text-sm font-light" data-testid="text-copyright">
              © {new Date().getFullYear()} Tabula Medica. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <span className="text-slate-500 text-sm font-light flex items-center gap-2">
                <Shield className="h-4 w-4 text-slate-600" />
                HIPAA Compliant
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
