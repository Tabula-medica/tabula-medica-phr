import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Heart,
  Activity,
  FileText,
  Link2,
  Smartphone,
  Lock,
  Brain,
  ChevronRight,
  Stethoscope,
  Pill,
  Calendar,
  TrendingUp,
  Users,
  Globe,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  Database,
  ShieldCheck,
  Network,
} from "lucide-react";

const features = [
  {
    icon: Link2,
    title: "Connect All Your Records",
    description: "Securely link health data from multiple providers, hospitals, and pharmacies in one unified view.",
  },
  {
    icon: Activity,
    title: "Unified Health Timeline",
    description: "See your complete medical history organized chronologically with smart filtering and search.",
  },
  {
    icon: Brain,
    title: "AI-Powered Insights",
    description: "Get plain-English explanations of medical terms and personalized health education.",
  },
  {
    icon: Shield,
    title: "Bank-Level Security",
    description: "Your health data is encrypted and protected with HIPAA-compliant infrastructure.",
  },
  {
    icon: Pill,
    title: "Medication Management",
    description: "Track medications, get safety alerts, and never miss important refills.",
  },
  {
    icon: Users,
    title: "Caregiver Access",
    description: "Safely share health records with family members and caregivers you trust.",
  },
];

const supportedSources = [
  { name: "Fasten Health", color: "#2563EB" },
  { name: "CMS Medicare", color: "#003366" },
  { name: "Blue Button 2.0", color: "#0071BC" },
  { name: "HIPAA Compliant", color: "#FF6B35" },
  { name: "FHIR R4", color: "#E44D26" },
  { name: "25K+ Providers", color: "#10B981" },
];

const benefits = [
  "View all your health records in one place",
  "Understand medical terms in plain English",
  "Share records securely with new doctors",
  "Track medications and get refill reminders",
  "Monitor health trends over time",
  "Access records anytime, anywhere",
];

export default function Welcome() {
  return (
    <div className="min-h-screen bg-background" data-testid="page-welcome">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center">
            <img src="/logo.png" alt="Tabula Medica" className="h-10 drop-shadow-sm" />
          </div>
          
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" data-testid="button-login-header">
                Log In
              </Button>
            </Link>
            <Link href="/login">
              <Button data-testid="button-signup-header">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent pointer-events-none" />
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <Badge variant="secondary" className="mb-4" data-testid="badge-tagline">
              Free for Patients Worldwide
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6" data-testid="text-hero-title">
              Your Complete Table of Health,{" "}
              <span className="text-accent-foreground bg-accent px-2 rounded">Free & Worldwide</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto" data-testid="text-hero-description">
              Tabula Medica brings together your health records from every doctor, hospital, and pharmacy 
              into a single, secure, easy-to-understand view that you control — at no cost, anywhere in the world.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/setup-wizard">
                <Button size="lg" className="gap-2" data-testid="button-get-started">
                  Get Started Free
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button variant="outline" size="lg" className="gap-2" data-testid="button-learn-more">
                <Stethoscope className="h-4 w-4" />
                  See How It Works
                </Button>
              </a>
            </div>
            
            <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
              <span className="text-sm text-muted-foreground">Connects with:</span>
              {supportedSources.map((source) => (
                <Badge 
                  key={source.name} 
                  variant="outline" 
                  className="text-xs"
                  data-testid={`badge-source-${source.name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <span 
                    className="w-2 h-2 rounded-full mr-1.5" 
                    style={{ backgroundColor: source.color }}
                  />
                  {source.name}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" data-testid="text-features-title">
              Everything You Need to Manage Your Health
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built by patients, for patients worldwide. Tabula Medica is free and puts you in control of your health information.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="hover-elevate" data-testid={`card-feature-${index}`}>
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-lg bg-accent/50 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-accent-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-4" data-testid="badge-how-it-works">How It Works</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4" data-testid="text-how-it-works-title">
              Your Data Silo. Your Key. Your Control.
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Tabula Medica uses zero-knowledge encryption so that only you can unlock your health data. 
              We never hold the keys to your silo.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <Card className="text-center" data-testid="card-step-connect">
              <CardContent className="p-6">
                <div className="h-14 w-14 rounded-full bg-accent/50 flex items-center justify-center mx-auto mb-4">
                  <Network className="h-7 w-7 text-accent-foreground" />
                </div>
                <div className="text-sm font-semibold text-muted-foreground mb-1">Step 1</div>
                <h3 className="text-lg font-semibold mb-2">Connect Your Providers</h3>
                <p className="text-muted-foreground text-sm">
                  Link your health records from 25,000+ US healthcare providers securely via Fasten Health.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center" data-testid="card-step-encrypt">
              <CardContent className="p-6">
                <div className="h-14 w-14 rounded-full bg-accent/50 flex items-center justify-center mx-auto mb-4">
                  <Fingerprint className="h-7 w-7 text-accent-foreground" />
                </div>
                <div className="text-sm font-semibold text-muted-foreground mb-1">Step 2</div>
                <h3 className="text-lg font-semibold mb-2">Biometric Key Encryption</h3>
                <p className="text-muted-foreground text-sm">
                  Your data is encrypted with AES-256-GCM using a key derived from your biometric identity. 
                  Only your fingerprint or face can unlock your health silo.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center" data-testid="card-step-control">
              <CardContent className="p-6">
                <div className="h-14 w-14 rounded-full bg-accent/50 flex items-center justify-center mx-auto mb-4">
                  <KeyRound className="h-7 w-7 text-accent-foreground" />
                </div>
                <div className="text-sm font-semibold text-muted-foreground mb-1">Step 3</div>
                <h3 className="text-lg font-semibold mb-2">You Hold the Only Key</h3>
                <p className="text-muted-foreground text-sm">
                  Tabula Medica never stores your encryption key. We cannot access, read, or share your data. 
                  Only your biometric key can unlock the silo.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-accent/30" data-testid="card-zero-knowledge">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col md:flex-row items-start gap-6">
                <div className="h-16 w-16 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-8 w-8 text-accent-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2" data-testid="text-zk-title">Zero-Knowledge Architecture</h3>
                  <p className="text-muted-foreground mb-4">
                    Unlike traditional health record systems, Tabula Medica operates on a zero-knowledge principle. 
                    Your health data is encrypted client-side before it ever reaches our servers. We do not hold the 
                    keys to your silo. Only your biometric key, derived from your fingerprint or facial recognition, 
                    can decrypt and access your records. Even our own engineers cannot view your data.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" data-testid="badge-aes256">AES-256-GCM Encryption</Badge>
                    <Badge variant="outline" data-testid="badge-zero-knowledge">Zero-Knowledge Proof</Badge>
                    <Badge variant="outline" data-testid="badge-biometric-key">Biometric Key Derivation</Badge>
                    <Badge variant="outline" data-testid="badge-client-side">Client-Side Encryption</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-4" data-testid="badge-interoperability">Interoperability</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4" data-testid="text-interop-title">
              Built on Open Standards
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Tabula Medica is USCDI v6 compliant (released July 2025), exceeding the mandatory federal standard for electronic health 
              records. Your data moves freely and securely between providers via FHIR R4/R5 APIs. USCDI v7 draft (January 2026) is being tracked for future compliance.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card data-testid="card-uscdi-v6">
              <CardContent className="p-5">
                <div className="h-10 w-10 rounded-lg bg-accent/50 flex items-center justify-center mb-3">
                  <Database className="h-5 w-5 text-accent-foreground" />
                </div>
                <h3 className="font-semibold mb-1">USCDI v6 Compliant</h3>
                <p className="text-sm text-muted-foreground">
                  Latest federal data standard (released July 2025) for all certified health IT systems. Tracking v7 draft for future readiness.
                </p>
              </CardContent>
            </Card>
            <Card data-testid="card-fhir-r4">
              <CardContent className="p-5">
                <div className="h-10 w-10 rounded-lg bg-accent/50 flex items-center justify-center mb-3">
                  <Link2 className="h-5 w-5 text-accent-foreground" />
                </div>
                <h3 className="font-semibold mb-1">FHIR R4/R5 Ready</h3>
                <p className="text-sm text-muted-foreground">
                  Full HL7 FHIR R4 implementation with R5 readiness, ensuring seamless data exchange with any compliant provider.
                </p>
              </CardContent>
            </Card>
            <Card data-testid="card-tefca">
              <CardContent className="p-5">
                <div className="h-10 w-10 rounded-lg bg-accent/50 flex items-center justify-center mb-3">
                  <Network className="h-5 w-5 text-accent-foreground" />
                </div>
                <h3 className="font-semibold mb-1">TEFCA Ready</h3>
                <p className="text-sm text-muted-foreground">
                  Connected to Qualified Health Information Networks for nationwide health data exchange.
                </p>
              </CardContent>
            </Card>
            <Card data-testid="card-smart-fhir">
              <CardContent className="p-5">
                <div className="h-10 w-10 rounded-lg bg-accent/50 flex items-center justify-center mb-3">
                  <Shield className="h-5 w-5 text-accent-foreground" />
                </div>
                <h3 className="font-semibold mb-1">Secure by Design</h3>
                <p className="text-sm text-muted-foreground">
                  End-to-end encryption and HIPAA-compliant infrastructure protect your health data.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground" data-testid="text-standards-list">
              Also supports: HL7 v2/v3, C-CDA, X12 EDI, DICOM/DICOMweb, LOINC, SNOMED CT, RxNorm, ICD-10, Apple HealthKit, Google Health Connect
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="secondary" className="mb-4">Why Tabula Medica</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-6" data-testid="text-benefits-title">
                Take Control of Your Health Journey
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                No more requesting paper copies from every doctor. No more forgetting important details 
                during appointments. Tabula Medica gives you instant access to your complete medical history.
              </p>
              
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3" data-testid={`item-benefit-${index}`}>
                    <CheckCircle2 className="h-5 w-5 text-accent-foreground shrink-0 mt-0.5" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
              
              <div className="mt-8">
                <Link href="/login">
                  <Button size="lg" className="gap-2" data-testid="button-start-now">
                    Start Now
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
            
            <div className="relative">
              <Card className="p-6" data-testid="card-preview">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
                      <Heart className="h-5 w-5 text-accent-foreground" />
                    </div>
                    <div>
                      <div className="font-semibold">Your Health Dashboard</div>
                      <div className="text-sm text-muted-foreground">All records synchronized</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <Card className="p-3 text-center">
                      <FileText className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                      <div className="text-2xl font-bold">47</div>
                      <div className="text-xs text-muted-foreground">Records</div>
                    </Card>
                    <Card className="p-3 text-center">
                      <Pill className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                      <div className="text-2xl font-bold">5</div>
                      <div className="text-xs text-muted-foreground">Medications</div>
                    </Card>
                    <Card className="p-3 text-center">
                      <Calendar className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                      <div className="text-2xl font-bold">3</div>
                      <div className="text-xs text-muted-foreground">Providers</div>
                    </Card>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Recent Activity</div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Lab results from General Hospital</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Blood pressure trending down</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
              
              <div className="absolute -bottom-4 -right-4 p-3 rounded-lg bg-background border shadow-lg" data-testid="card-security-badge">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-accent-foreground" />
                  <span className="text-sm font-medium">HIPAA Compliant</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <Card className="p-8 md:p-12 text-center" data-testid="card-cta">
            <div className="max-w-2xl mx-auto">
              <div className="h-16 w-16 rounded-full bg-accent flex items-center justify-center mx-auto mb-6">
                <Globe className="h-8 w-8 text-accent-foreground" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to Take Control?
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Join thousands of patients who have simplified their healthcare experience. 
                Connect your records in minutes and start your health journey today.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/login">
                  <Button size="lg" className="gap-2" data-testid="button-create-account">
                    Create Free Account
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline" size="lg" data-testid="button-sign-in">
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <footer className="py-8 border-t">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Tabula Medica - Your Complete Table of Health, Free Worldwide
              </span>
            </div>
            <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Lock className="h-4 w-4" />
                HIPAA Compliant
              </span>
              <span className="flex items-center gap-1">
                <Shield className="h-4 w-4" />
                Zero-Knowledge Encryption
              </span>
              <span className="flex items-center gap-1">
                <Database className="h-4 w-4" />
                USCDI v6
              </span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-4 w-4" />
                HSTS Enforced
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
