import { useState, useMemo } from "react";
import { useSEO, buildFAQSchema, buildBreadcrumbSchema, buildMedicalWebPageSchema } from "@/hooks/use-seo";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Search,
  Shield,
  CreditCard,
  Database,
  Heart,
  Lock,
  Globe,
  Smartphone,
  ArrowRight,
  Brain,
  Stethoscope,
  UserCog,
} from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    category: "Getting Started",
    question: "What is Tabula Medica?",
    answer: "Tabula Medica is a patient health record app that connects directly to your hospitals, clinics, and labs using SMART on FHIR and TEFCA. It pulls your medical data — labs, medications, conditions, immunizations, procedures — into one secure, easy-to-read timeline. No faxes, no phone calls, no paper forms.",
  },
  {
    category: "Getting Started",
    question: "How do I get started?",
    answer: "Download the app, create an account, and search for your hospital or health system. You'll log into your patient portal once through a secure OAuth connection, and your records will sync automatically. The whole process takes about 2 minutes.",
  },
  {
    category: "Getting Started",
    question: "Which hospitals and health systems are supported?",
    answer: "Tabula Medica supports over 25,000 FHIR-enabled healthcare organizations across the United States, including Epic MyChart, Cerner, athenahealth, MEDITECH, and more. You can search for your specific hospital directly in the app. Through TEFCA, we also access records from eHealth Exchange, Carequality, CommonWell, CARIN Alliance, and Epic Nexus networks.",
  },
  {
    category: "Getting Started",
    question: "Do I need my doctor's permission to use Tabula Medica?",
    answer: "No. Under the 21st Century Cures Act and the ONC Information Blocking Rule, patients have the legal right to access their electronic health records through apps like Tabula Medica. Your healthcare provider is required by federal law to make this data available to you.",
  },
  {
    category: "Getting Started",
    question: "What types of health data can I see?",
    answer: "You can view lab results, medications, allergies, immunizations, conditions and diagnoses, procedures, vital signs, clinical notes, imaging reports, and insurance claims. The specific data available depends on what your healthcare provider stores in their EHR system.",
  },

  {
    category: "Pricing & Plans",
    question: "How much does Tabula Medica cost?",
    answer: "The Starter plan includes 1 hospital/clinic connection, a full health timeline view, a drug savings finder that compares prescription prices, and an FQHC locator to find low-cost care near you. Pro ($9.99/mo) unlocks unlimited connections, AI insights, and more.",
  },
  {
    category: "Pricing & Plans",
    question: "What does Tabula Medica Pro include?",
    answer: "Pro ($9.99/month or $99.90/year) adds unlimited hospital connections, an AI health assistant that explains your records in plain language, care team sharing so your doctors can see your full history, up to 6 family profiles, 5 GB of encrypted document storage, and wearable device sync (Apple Health, Fitbit, Oura, etc.).",
  },
  {
    category: "Pricing & Plans",
    question: "Is there a trial period?",
    answer: "Yes. Tabula Medica Pro comes with a 14-day trial. You can cancel anytime during the trial and won't be charged. After the trial, you'll automatically revert to the Starter plan — you won't lose any data.",
  },
  {
    category: "Pricing & Plans",
    question: "Can I cancel my subscription?",
    answer: "Yes. You can cancel at any time through the App Store, Google Play, or your account settings. Your Pro features remain active until the end of your current billing period. After that, you revert to the Starter plan. Your data is never deleted.",
  },
  {
    category: "Pricing & Plans",
    question: "Do you offer family plans?",
    answer: "The Pro plan includes up to 6 health profiles, so you can manage records for your children, elderly parents, or other dependents — all under one account. Each profile has its own separate health timeline and can connect to different healthcare providers.",
  },

  {
    category: "Privacy & Security",
    question: "Is my health data safe?",
    answer: "Yes. Tabula Medica runs on HIPAA-aligned infrastructure with a SOC 2 Type II audit in progress. All data is encrypted with AES-256-GCM at rest and TLS 1.3 in transit, protected by strict access controls and full audit logging. We never sell, share, or monetize your data.",
  },
  {
    category: "Privacy & Security",
    question: "Who can see my health records?",
    answer: "Only you. Your data is encrypted with keys that only you control. If you choose to share records with a provider or family member through care team sharing, you control exactly which records they can see, and you can revoke access at any time.",
  },
  {
    category: "Privacy & Security",
    question: "Does Tabula Medica sell my data?",
    answer: "No. Never. We do not sell, share, rent, or monetize your health data in any way. Our business model is based on optional paid subscriptions, not data brokering. This is a core principle of our company and is reflected in our Terms of Service.",
  },
  {
    category: "Privacy & Security",
    question: "What happens to my data if I delete my account?",
    answer: "When you delete your account, all your health records, documents, and personal information are permanently and irreversibly deleted from our servers within 30 days. We provide a data export option so you can download everything before deletion.",
  },
  {
    category: "Privacy & Security",
    question: "Do you support CAC/PIV authentication?",
    answer: "Yes. For military and government users, Tabula Medica supports Common Access Card (CAC) and Personal Identity Verification (PIV) card authentication through WebAuthn/FIDO2, meeting DoD and FedRAMP requirements.",
  },

  {
    category: "Connections & Data",
    question: "How does SMART on FHIR work?",
    answer: "SMART on FHIR is a healthcare industry standard for securely connecting apps to electronic health records. When you connect to a hospital, you authenticate through their official patient portal (like MyChart). The hospital then shares your records with Tabula Medica through a secure, standardized API — the same technology hospitals use to share data with each other.",
  },
  {
    category: "Connections & Data",
    question: "What is TEFCA and how does it help me?",
    answer: "TEFCA (Trusted Exchange Framework and Common Agreement) is a federal framework that lets health networks share patient data across organizational boundaries. Through our TEFCA bridge, a single login can authorize access to your records across multiple health networks simultaneously — eliminating the need to log into each hospital separately.",
  },
  {
    category: "Connections & Data",
    question: "Can I connect dental or pharmacy records?",
    answer: "Many dental offices and pharmacies are not yet on TEFCA or FHIR networks. For these providers, Tabula Medica uses Fasten Health's direct connect feature, which supports a wider range of healthcare organizations including dental clinics, pharmacies, and independent practices.",
  },
  {
    category: "Connections & Data",
    question: "How often does my data sync?",
    answer: "Connected health sources sync automatically. After the initial connection, new records typically appear within 24 hours of being added to your provider's system. You can also trigger a manual sync at any time from the Data Sources page.",
  },
  {
    category: "Connections & Data",
    question: "Can I import records manually?",
    answer: "Yes. You can upload clinical documents (PDFs, images, FHIR bundles) directly to your timeline. This is useful for records from providers who don't support electronic connections, or for paper documents you want to digitize.",
  },

  {
    category: "Uninsured Patients",
    question: "Can I use Tabula Medica without health insurance?",
    answer: "Absolutely. Tabula Medica's Uninsurance Mode is specifically designed for the 28+ million uninsured Americans. It includes a clinic finder (FQHCs), drug price comparison tools, sliding-scale care resources, and access to your health records.",
  },
  {
    category: "Uninsured Patients",
    question: "What are FQHCs and how do I find them?",
    answer: "Federally Qualified Health Centers (FQHCs) are community-based clinics that provide primary care on a sliding fee scale based on your ability to pay. Tabula Medica's built-in FQHC finder uses your location to show nearby centers, their services, hours, and contact information.",
  },
  {
    category: "Uninsured Patients",
    question: "How does the drug savings finder work?",
    answer: "The drug savings finder compares prescription prices across pharmacies near you and finds available discount programs, manufacturer coupons, and generic alternatives. Many patients save 50-80% on their medications using this feature.",
  },

  {
    category: "Mobile & Accessibility",
    question: "Is there a mobile app?",
    answer: "Tabula Medica is a Progressive Web App (PWA) that works on any device — iPhone, Android, tablet, or desktop. Install it directly from your browser for a native app experience. A dedicated iOS app with StoreKit 2 integration is also available on the App Store.",
  },
  {
    category: "Mobile & Accessibility",
    question: "What languages are supported?",
    answer: "The interface is available in 19 languages including English, Spanish, French, German, Chinese, Japanese, Korean, Arabic, Hindi, and Portuguese. Medical terminology translation supports over 50 languages through our AI-powered translation engine.",
  },
  {
    category: "Mobile & Accessibility",
    question: "Is Tabula Medica accessible for people with disabilities?",
    answer: "Yes. We follow WCAG 2.1 AA guidelines. Features include screen reader support, keyboard navigation, voice commands, dyslexia-friendly fonts, color-blind modes, adjustable text sizes, and a reading guide. Accessibility is a core design principle, not an afterthought.",
  },
  {
    category: "Mobile & Accessibility",
    question: "Does it work offline?",
    answer: "Yes. Previously synced records are available offline through our service worker caching. You can view your health timeline, medications, and conditions without an internet connection. New data will sync automatically when you reconnect.",
  },

  {
    category: "AI & Insights",
    question: "How does the AI health assistant work?",
    answer: "The AI health assistant reads your medical records and explains them in plain language. Ask questions like 'What does my A1C level mean?' or 'Are any of my medications interacting?' and get instant, personalized explanations. It never provides diagnoses or treatment recommendations — only educational information and transparency about your existing records.",
  },
  {
    category: "AI & Insights",
    question: "Can the AI diagnose me or prescribe medication?",
    answer: "No. Tabula Medica's AI is strictly informational. It helps you understand your existing medical records — lab values, medication names, procedure codes — but it never provides clinical decision support, diagnoses, or treatment advice. Always consult your healthcare provider for medical decisions.",
  },
  {
    category: "AI & Insights",
    question: "What is AI Thinking Mode?",
    answer: "AI Thinking Mode shows you the step-by-step reasoning behind every AI-generated explanation. When the AI explains a lab result, you can expand the 'How the AI reached this explanation' panel to see its full reasoning chain. This transparency helps you verify the AI's work and understand its logic.",
  },
  {
    category: "AI & Insights",
    question: "Can I scan paper medical documents?",
    answer: "Yes. The document scanner uses AI-powered OCR to extract structured data from photos of hospital bills, lab results, prescriptions, and insurance cards. Point your camera or upload a photo, and the AI converts it into organized, searchable health data in your timeline.",
  },
  {
    category: "AI & Insights",
    question: "Does the AI have access to my data outside the app?",
    answer: "No. All AI processing happens within Tabula Medica's secure infrastructure. Your health data is never sent to external AI training datasets, third-party models, or advertising networks. The AI only accesses records you explicitly share within the app.",
  },

  {
    category: "Clinical & Medical",
    question: "How do I share records with my doctor?",
    answer: "Use the Care Team Sharing feature to invite your doctor by email. They'll receive a secure link to view exactly the records you choose to share. You control which categories (labs, medications, conditions, etc.) they can see, and you can revoke access at any time.",
  },
  {
    category: "Clinical & Medical",
    question: "Can I export my records as a PDF?",
    answer: "Yes. The Packet Export feature generates a professional PDF document containing your selected health records, formatted for sharing with providers, specialists, or insurance companies. You can choose which record categories to include and generate the PDF with one tap.",
  },
  {
    category: "Clinical & Medical",
    question: "What is medication reconciliation?",
    answer: "Medication reconciliation compares medications from different sources (hospitals, pharmacies, specialists) to identify duplicates, interactions, and discrepancies. Tabula Medica does this automatically when you connect multiple providers, helping you and your doctor see your complete, accurate medication list.",
  },
  {
    category: "Clinical & Medical",
    question: "Does Tabula Medica check for drug interactions?",
    answer: "Yes. When your records include medications from multiple providers, the app flags potential drug-drug interactions and duplicate prescriptions. This is educational information to discuss with your healthcare provider — not medical advice. Always consult your doctor or pharmacist before making medication changes.",
  },
  {
    category: "Clinical & Medical",
    question: "Can I track my lab results over time?",
    answer: "Yes. The health timeline displays your lab results chronologically with trend charts that show how values like cholesterol, blood sugar, thyroid levels, and kidney function change over time. Reference ranges are shown alongside your values so you can see when results fall outside normal limits.",
  },
  {
    category: "Clinical & Medical",
    question: "What medical coding systems does Tabula Medica support?",
    answer: "Tabula Medica supports all major medical coding systems: SNOMED CT for clinical terms, LOINC for lab results, ICD-10-CM for diagnoses, RxNorm for medications, CPT for procedures, and CVX for immunizations. These codes are automatically translated into plain-language descriptions.",
  },

  {
    category: "Account & Billing",
    question: "How do I delete my account?",
    answer: "Go to Settings > Account > Delete Account. You'll be asked to confirm, and then given the option to export all your data first. After confirmation, all records, documents, and personal information are permanently deleted from our servers within 30 days. This action cannot be undone.",
  },
  {
    category: "Account & Billing",
    question: "Can I switch from monthly to annual billing?",
    answer: "Yes. Go to Settings > Subscription and select the annual plan. You'll receive a prorated credit for the unused portion of your current monthly subscription. The annual plan costs $99.90/year — a savings of about 17% compared to monthly billing.",
  },
  {
    category: "Account & Billing",
    question: "What payment methods are accepted?",
    answer: "On iOS, payments are processed through Apple's App Store using your Apple ID payment method. On Android, payments go through Google Play. On the web, we accept credit/debit cards and Apple Pay through our secure payment processor. All transactions are encrypted and PCI DSS compliant.",
  },
];

const CATEGORIES = [
  { id: "all", label: "All Questions", icon: Globe },
  { id: "Getting Started", label: "Getting Started", icon: Heart },
  { id: "Pricing & Plans", label: "Pricing & Plans", icon: CreditCard },
  { id: "Privacy & Security", label: "Privacy & Security", icon: Lock },
  { id: "Connections & Data", label: "Connections & Data", icon: Database },
  { id: "AI & Insights", label: "AI & Insights", icon: Brain },
  { id: "Clinical & Medical", label: "Clinical & Medical", icon: Stethoscope },
  { id: "Uninsured Patients", label: "Uninsured Patients", icon: Shield },
  { id: "Mobile & Accessibility", label: "Accessibility", icon: Smartphone },
  { id: "Account & Billing", label: "Account & Billing", icon: UserCog },
];

export default function FAQPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const filteredFaqs = useMemo(() => {
    let result = FAQ_DATA;
    if (activeCategory !== "all") {
      result = result.filter((f) => f.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
      );
    }
    return result;
  }, [activeCategory, searchQuery]);

  const faqStructuredData = useMemo(() => [
    buildFAQSchema(FAQ_DATA),
    buildBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "FAQ", path: "/faq" },
    ]),
    buildMedicalWebPageSchema({
      name: "Frequently Asked Questions - Tabula Medica",
      description: "Answers to common questions about Tabula Medica — connecting to hospitals, privacy, pricing, FHIR, TEFCA, uninsured access, and more.",
      path: "/faq",
      medicalAudience: "Patient",
    }),
  ], []);

  useSEO({
    title: "Frequently Asked Questions",
    description: "Answers to common questions about Tabula Medica — connecting to hospitals, privacy, pricing, SMART on FHIR, TEFCA, uninsured patient access, accessibility, and more.",
    canonicalPath: "/faq",
    structuredData: faqStructuredData,
  });

  const groupedFaqs = useMemo(() => {
    const groups: Record<string, FAQItem[]> = {};
    filteredFaqs.forEach((faq) => {
      if (!groups[faq.category]) groups[faq.category] = [];
      groups[faq.category].push(faq);
    });
    return groups;
  }, [filteredFaqs]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 pt-10 pb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-foreground mb-3" data-testid="text-faq-title">
            How can we help?
          </h1>
          <p className="text-muted-foreground text-lg mb-6 max-w-xl mx-auto">
            Find answers to common questions about your health records, privacy, connections, and more.
          </p>
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 rounded-xl"
              data-testid="input-faq-search"
            />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8">
        <div className="flex flex-wrap gap-2 mb-8">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              data-testid={`faq-category-${cat.id.replace(/\s+/g, "-").toLowerCase()}`}
            >
              <cat.icon className="h-3.5 w-3.5" />
              {cat.label}
            </button>
          ))}
        </div>

        {filteredFaqs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-2">No matching questions found.</p>
            <button
              onClick={() => { setSearchQuery(""); setActiveCategory("all"); }}
              className="text-primary text-sm font-medium hover:underline"
              data-testid="button-clear-faq-filter"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-10">
            {Object.entries(groupedFaqs).map(([category, faqs]) => (
              <div key={category}>
                <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2" data-testid={`faq-section-${category.replace(/\s+/g, "-").toLowerCase()}`}>
                  {category}
                  <Badge variant="secondary" className="text-xs">{faqs.length}</Badge>
                </h2>
                <div className="space-y-2">
                  {faqs.map((faq, idx) => (
                    <details
                      key={idx}
                      className="group bg-card border border-border/60 rounded-xl overflow-hidden"
                      data-testid={`faq-detail-${category.replace(/\s+/g, "-").toLowerCase()}-${idx}`}
                    >
                      <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none text-sm sm:text-base font-medium text-foreground hover:bg-muted/50 transition-colors list-none">
                        <span>{faq.question}</span>
                        <svg className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                      </summary>
                      <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
                        {faq.answer}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 p-6 rounded-2xl bg-primary/5 border border-primary/10 text-center">
          <h3 className="text-lg font-semibold mb-2" data-testid="text-faq-cta">Still have questions?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Our AI health assistant can answer questions specific to your records, or you can reach our support team.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/health-assistant">
              <Button size="sm" className="gap-1.5" data-testid="button-faq-assistant">
                Ask AI Assistant
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <Link href="/about/security">
              <Button size="sm" variant="outline" data-testid="button-faq-security">
                Security Details
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
