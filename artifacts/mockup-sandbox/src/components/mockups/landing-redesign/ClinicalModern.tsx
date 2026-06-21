import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Shield, Heart, ArrowRight, Link2, Globe, Lock,
  Search, Building2, MapPin, Loader2, ExternalLink,
  Activity, Brain, Languages, CheckCircle2,
  Network, Sparkles, GitMerge, QrCode, Mail,
  KeyRound, UserCheck, ServerCrash, Github, Twitter
} from "lucide-react";

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

export function ClinicalModern() {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-teal-100 selection:text-teal-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 sm:px-10 py-4 bg-white/90 backdrop-blur-md border-b border-teal-50/50">
        <div className="flex items-center gap-2" data-testid="text-brand-name">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white shadow-sm">
            <Heart className="w-5 h-5 fill-current" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-800">Tabula Medica</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#how-it-works" className="text-sm font-medium text-slate-500 hover:text-teal-600 transition-colors hidden sm:inline">How It Works</a>
          <a href="#features" className="text-sm font-medium text-slate-500 hover:text-teal-600 transition-colors hidden sm:inline">Features</a>
          <a href="#privacy-oauth" className="text-sm font-medium text-slate-500 hover:text-teal-600 transition-colors hidden md:inline" data-testid="link-header-privacy-oauth">Privacy</a>
          <Button variant="ghost" className="hidden sm:inline-flex text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-full px-6">
            Log In
          </Button>
          <Button className="rounded-full bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-200/50 px-6" data-testid="button-nav-login">
            Get Started
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-teal-50/80 to-white -z-10" />
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[800px] h-[800px] bg-emerald-50/50 rounded-full blur-3xl opacity-50 -z-10" />
        <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-[600px] h-[600px] bg-teal-50/50 rounded-full blur-3xl opacity-50 -z-10" />

        <div className="max-w-7xl mx-auto px-6 sm:px-10 grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100/50 border border-emerald-200/50 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Free forever for patients
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 leading-[1.1] tracking-tight" data-testid="text-hero-heading">
              Your Clinical History, <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-500">
                Unified and Simplified.
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-600 leading-relaxed" data-testid="text-hero-description">
              Tabula Medica is a secure, patient-facing platform designed to solve the problem of fragmented medical data. By leveraging the national TEFCA network and advanced AI, we empower patients to own their "Palm Record" — a deduplicated, summarized, and shareable clinical history.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button
                size="lg"
                className="h-14 px-8 text-base rounded-full bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-600/20 transition-all hover:-translate-y-0.5"
                data-testid="button-hero-login"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <a href="#how-it-works" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full h-14 px-8 text-base rounded-full border-2 border-teal-100 text-teal-700 hover:bg-teal-50 hover:border-teal-200 transition-all"
                  data-testid="button-hero-learn-more"
                >
                  <Search className="mr-2 h-5 w-5" />
                  Learn How It Works
                </Button>
              </a>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-3 pt-4">
              {["No credit card required", "HIPAA compliant", "Available worldwide"].map((item) => (
                <span key={item} className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative lg:h-[600px] flex items-center justify-center">
             <div className="absolute inset-0 bg-gradient-to-tr from-teal-100 to-emerald-50 rounded-[3rem] rotate-3 scale-105 opacity-50" />
             <img 
               src="/__mockup/images/clinical-hero.png" 
               alt="Tabula Medica Interface Mockup" 
               className="relative z-10 w-full max-w-lg rounded-[2.5rem] shadow-2xl shadow-teal-900/10 border-8 border-white object-cover aspect-square"
             />
          </div>
        </div>
      </section>

      {/* Trust Logos */}
      <div className="border-y border-slate-100 bg-slate-50/50 py-8">
        <div className="max-w-7xl mx-auto px-6 sm:px-10">
          <div className="flex flex-wrap items-center justify-center gap-12 sm:gap-20">
            {trustLogos.map((item) => (
              <div key={item.label} className="text-center group flex flex-col items-center">
                <Shield className="h-6 w-6 text-teal-300 mb-2 opacity-50 group-hover:opacity-100 group-hover:text-teal-500 transition-colors" />
                <p className="text-sm font-bold text-slate-700 tracking-wide uppercase">{item.label}</p>
                <p className="text-xs text-slate-400 font-medium">{item.sublabel}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-sm font-bold tracking-wider text-teal-600 uppercase mb-3">The Process</h2>
            <h3 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6" data-testid="text-how-it-works-heading">
              How Tabula Medica Works
            </h3>
            <p className="text-lg text-slate-600" data-testid="text-how-it-works-description">
              Our application provides a secure interface for patients to interact with their own health data through the following core features:
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((item, idx) => (
              <div
                key={item.title}
                className="relative p-8 rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-teal-500/5 hover:-translate-y-1 transition-all duration-300 group"
                data-testid={`card-how-it-works-${idx}`}
              >
                <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center mb-6 group-hover:bg-teal-500 transition-colors duration-300">
                  <item.icon className="h-7 w-7 text-teal-600 group-hover:text-white transition-colors duration-300" />
                </div>
                <h4 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h4>
                <p className="text-slate-600 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy & Security */}
      <section id="privacy-oauth" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 sm:px-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mb-6">
              <Shield className="h-8 w-8" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6" data-testid="text-oauth-heading">
              Privacy & Security (OAuth Disclosure)
            </h2>
            <p className="text-lg text-slate-600" data-testid="text-oauth-description">
              Tabula Medica takes your data privacy seriously. To provide these services, we use Google OAuth to:
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
            {oauthDisclosure.map((item, idx) => (
              <div
                key={item.title}
                className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-center"
                data-testid={`card-oauth-${idx}`}
              >
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-5">
                  <item.icon className="h-6 w-6 text-emerald-600" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-3">{item.title}</h4>
                <p className="text-slate-600 text-sm leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="max-w-3xl mx-auto p-6 rounded-2xl bg-amber-50 border border-amber-100" data-testid="notice-no-medical-advice">
            <p className="text-sm text-amber-800 text-center leading-relaxed flex items-center justify-center gap-3">
              <Activity className="h-5 w-5 shrink-0" />
              <span><strong>Important:</strong> This application is a supportive tool and does not provide medical diagnoses. Always consult with a qualified healthcare professional for medical advice.</span>
            </p>
          </div>
        </div>
      </section>

      {/* Hospital Search */}
      <section id="find-hospital" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-10">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6" data-testid="text-hospital-search-heading">
              Connect to Your Hospital
            </h2>
            <p className="text-lg text-slate-600" data-testid="text-hospital-search-description">
              Search thousands of Epic-connected hospitals or select a health system below.
            </p>
          </div>

          <div className="max-w-2xl mx-auto mb-16">
            <div className="relative group">
              <div className="absolute inset-0 bg-teal-500/5 rounded-2xl blur-xl transition-all group-hover:bg-teal-500/10" />
              <div className="relative flex items-center">
                <Search className="absolute left-6 h-6 w-6 text-slate-400" />
                <Input
                  data-testid="input-landing-hospital-search"
                  placeholder="Search 25,000+ hospitals and health systems..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-16 pr-6 h-16 text-lg rounded-2xl border-2 border-slate-100 bg-white shadow-sm focus-visible:ring-0 focus-visible:border-teal-500"
                />
                <Button className="absolute right-2 h-12 rounded-xl bg-teal-600 hover:bg-teal-700 text-white px-6">
                  Search
                </Button>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {PRIORITY_HOSPITALS.map((hospital) => (
              <button
                key={hospital.name}
                data-testid={`button-priority-hospital-${hospital.name.toLowerCase().replace(/\s+/g, '-')}`}
                className="text-left p-6 rounded-3xl bg-slate-50 border border-slate-100 hover:border-teal-200 hover:bg-teal-50/50 transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ExternalLink className="h-4 w-4 text-teal-600" />
                </div>
                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-4 text-teal-600 group-hover:scale-110 transition-transform">
                  <Building2 className="h-6 w-6" />
                </div>
                <h4 className="font-bold text-slate-900 mb-1">{hospital.name}</h4>
                <p className="text-sm text-slate-500 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {hospital.region}
                </p>
              </button>
            ))}
          </div>

          <p className="text-center text-sm text-slate-400 mt-12 font-medium">
            Powered by SMART on FHIR — the healthcare industry standard for secure data access
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-teal-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-800 via-teal-900 to-slate-900" />
        <div className="relative max-w-7xl mx-auto px-6 sm:px-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-sm font-bold tracking-wider text-teal-400 uppercase mb-3">Comprehensive Care</h2>
            <h3 className="text-3xl sm:text-4xl font-bold mb-6" data-testid="text-features-heading">
              Everything You Need
            </h3>
            <p className="text-lg text-teal-100/80" data-testid="text-features-description">
              One secure platform to access, understand, and share your complete medical history.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors backdrop-blur-sm"
                data-testid={`card-feature-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center mb-6">
                  <feature.icon className="h-6 w-6 text-teal-300" />
                </div>
                <h4 className="text-xl font-bold mb-3">{feature.title}</h4>
                <p className="text-teal-100/70 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Providers Section */}
      <section className="py-24 bg-emerald-50">
        <div className="max-w-7xl mx-auto px-6 sm:px-10">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">Are you a healthcare provider?</h2>
              <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                Tabula Medica helps you make better clinical decisions by providing a deduplicated, AI-summarized view of your patient's complete history across all their care sites. Less time reading outside records, more time with patients.
              </p>
              <ul className="space-y-4 mb-8">
                {[
                  "Instantly view records from outside hospitals",
                  "Identify missing lab results and imaging",
                  "Avoid duplicate testing and procedures",
                  "Seamless integration with your existing EHR"
                ].map(item => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                    <span className="text-slate-700 font-medium">{item}</span>
                  </li>
                ))}
              </ul>
              <Button className="h-14 px-8 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-base">
                Provider Solutions
              </Button>
            </div>
            <div className="relative">
               <div className="absolute inset-0 bg-emerald-200 rounded-[3rem] rotate-6 scale-105" />
               <div className="relative bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                      <UserCheck className="h-8 w-8 text-slate-400" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-900">Dr. Sarah Jenkins</h4>
                      <p className="text-slate-500">Primary Care Physician</p>
                    </div>
                  </div>
                  <blockquote className="text-xl font-medium text-slate-700 leading-relaxed italic">
                    "Tabula Medica has completely transformed how I review outside records. Instead of digging through 200 pages of PDF faxes, I get a clean, chronological timeline of the patient's care."
                  </blockquote>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-white border-t border-slate-100">
        <div className="max-w-4xl mx-auto px-6 sm:px-10 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">Take Control of Your Health Data</h2>
          <p className="text-xl text-slate-600 mb-10">
            Join thousands of patients who use Tabula Medica to manage, understand, and share their medical history.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button className="h-14 px-10 rounded-full bg-teal-600 hover:bg-teal-700 text-white text-lg shadow-lg shadow-teal-600/20">
              Create Your Free Account
            </Button>
            <Button variant="outline" className="h-14 px-10 rounded-full border-2 border-slate-200 text-slate-700 hover:bg-slate-50 text-lg">
              Contact Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-16 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6 sm:px-10">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-16">
            <div className="col-span-2 lg:col-span-2">
              <div className="flex items-center gap-2 mb-6 text-white">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center">
                  <Heart className="w-5 h-5 fill-current" />
                </div>
                <span className="font-bold text-xl tracking-tight">Tabula Medica</span>
              </div>
              <p className="text-slate-400 leading-relaxed max-w-sm mb-6">
                Empowering patients with secure, unified, and understandable medical records powered by AI and national interoperability networks.
              </p>
              <div className="flex items-center gap-4">
                <a href="#" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-teal-600 hover:text-white transition-colors">
                  <Twitter className="h-5 w-5" />
                </a>
                <a href="#" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-teal-600 hover:text-white transition-colors">
                  <Github className="h-5 w-5" />
                </a>
                <a href="#" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-teal-600 hover:text-white transition-colors">
                  <Mail className="h-5 w-5" />
                </a>
              </div>
            </div>
            
            <div>
              <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-sm">Platform</h4>
              <ul className="space-y-4">
                <li><a href="#" className="hover:text-teal-400 transition-colors">How it Works</a></li>
                <li><a href="#" className="hover:text-teal-400 transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-teal-400 transition-colors">For Providers</a></li>
                <li><a href="#" className="hover:text-teal-400 transition-colors">Hospital Network</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-sm">Company</h4>
              <ul className="space-y-4">
                <li><a href="#" className="hover:text-teal-400 transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-teal-400 transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-teal-400 transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-teal-400 transition-colors">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-sm">Legal</h4>
              <ul className="space-y-4">
                <li><a href="/privacy-policy" className="hover:text-teal-400 transition-colors">Privacy Policy</a></li>
                <li><a href="/terms" className="hover:text-teal-400 transition-colors">Terms of Service</a></li>
                <li><a href="/security" className="hover:text-teal-400 transition-colors">Security Practices</a></li>
                <li><a href="/baa" className="hover:text-teal-400 transition-colors">BAA Details</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm">
              © {new Date().getFullYear()} Tabula Medica. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm">
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4" /> HIPAA Compliant
              </span>
              <span className="flex items-center gap-2">
                <Lock className="h-4 w-4" /> SOC 2 Type II
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
