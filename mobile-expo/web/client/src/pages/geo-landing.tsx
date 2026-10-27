import { useSeoMeta, buildFAQSchema, buildBreadcrumbSchema, buildMedicalWebPageSchema } from "@/lib/seo";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Shield,
  MapPin,
  Heart,
  Building2,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  FileText,
  Brain,
} from "lucide-react";

interface StateConfig {
  slug: string;
  name: string;
  abbreviation: string;
  description: string;
  complianceLaw: string;
  complianceSummary: string;
  fqhcCount: number;
  populationUninsured: string;
  medicaidExpansion: boolean;
  keyFacts: string[];
  faqs: { question: string; answer: string }[];
  sources?: { label: string; url: string }[];
}

const STATE_CONFIGS: Record<string, StateConfig> = {
  california: {
    slug: "california",
    name: "California",
    abbreviation: "CA",
    description:
      "Find free health clinics, drug savings, and HIPAA-compliant health records tools for California residents. Tabula Medica meets California AB 3030 AI disclosure requirements for clinical AI tools.",
    complianceLaw: "CA AB 3030",
    complianceSummary:
      "California AB 3030 (effective January 1, 2025) requires healthcare providers using generative AI to draft patient communications to include a disclosure. Tabula Medica's AI features comply: every AI-generated summary carries a clear disclosure, and no AI-generated text is delivered to patients without explicit labeling.",
    fqhcCount: 1_200,
    populationUninsured: "6.5%",
    medicaidExpansion: true,
    keyFacts: [
      "Medi-Cal covers adults up to 138% FPL — Tabula Medica can help you verify coverage and connect your records.",
      "Over 1,200 FQHC sites statewide offer sliding-scale care regardless of immigration status.",
      "California's CMIA (Confidentiality of Medical Information Act) requires stricter consent than federal HIPAA — Tabula Medica's consent layer satisfies both.",
      "Covered California open enrollment runs November 1 – January 31 each year.",
    ],
    faqs: [
      {
        question: "Does Tabula Medica comply with California AB 3030?",
        answer:
          "Yes. California AB 3030 requires healthcare providers using generative AI to include disclosures on AI-generated patient communications. Every AI-generated summary in Tabula Medica is labeled as AI-generated, and no AI content is delivered to patients without explicit disclosure.",
      },
      {
        question: "Where can I find free or low-cost care in California?",
        answer:
          "California has over 1,200 FQHC (Federally Qualified Health Center) sites that offer free or sliding-scale care regardless of insurance status or immigration status. Use Tabula Medica's free care finder at tabulamedica.health/find-free-care to locate the nearest clinic.",
      },
      {
        question: "Does California Medi-Cal cover all residents?",
        answer:
          "California expanded Medi-Cal to cover all income-eligible adults regardless of immigration status. Adults with household income up to 138% of the Federal Poverty Level generally qualify. Tabula Medica can connect your records across Medi-Cal managed care plans.",
      },
      {
        question: "How does the California CMIA affect my health data?",
        answer:
          "The California Confidentiality of Medical Information Act (CMIA) provides stronger privacy protections than federal HIPAA, requiring explicit authorization before sharing medical information with third parties. Tabula Medica's consent architecture satisfies both HIPAA and CMIA requirements.",
      },
      {
        question: "Can I use Tabula Medica to connect my Kaiser or Sutter records?",
        answer:
          "Yes. Tabula Medica supports SMART on FHIR connections to Kaiser Permanente, Sutter Health, Dignity Health, UCSF, Cedars-Sinai, and thousands of other California health systems. Connect your records in the app and they sync automatically.",
      },
    ],
  },
  texas: {
    slug: "texas",
    name: "Texas",
    abbreviation: "TX",
    description:
      "Free health clinics, drug savings, and HIPAA-compliant health record tools for Texas residents. Tabula Medica is designed to comply with Texas TRAIGA AI governance requirements.",
    complianceLaw: "TX TRAIGA",
    complianceSummary:
      "The Texas Responsible AI Governance Act (TRAIGA) establishes requirements for developers and deployers of high-risk AI systems, including those used in healthcare. Tabula Medica's AI features include human oversight mechanisms, explainability disclosures, and audit logging that align with TRAIGA's requirements for healthcare AI.",
    fqhcCount: 750,
    populationUninsured: "16.6%",
    medicaidExpansion: false,
    keyFacts: [
      "Texas has the highest uninsured rate in the US at ~16.6% — FQHCs are a critical safety net.",
      "Texas did not expand Medicaid; adults without children generally do not qualify for traditional Medicaid.",
      "Tabula Medica's drug savings finder is especially valuable in Texas, where high uninsured rates mean many patients pay out-of-pocket.",
      "UT Health, Texas Health Resources, Baylor Scott & White, and 10,000+ other TX systems are FHIR-connected.",
    ],
    faqs: [
      {
        question: "Does Tabula Medica comply with Texas TRAIGA?",
        answer:
          "Tabula Medica's AI features are designed with the governance principles of TRAIGA in mind: every AI-generated output carries a disclosure, human oversight is always available, and audit logs track all AI interactions. We continue to monitor TRAIGA rulemaking for specific compliance requirements.",
      },
      {
        question: "I don't have insurance in Texas. What are my options?",
        answer:
          "Texas has 750+ FQHC sites offering free or sliding-scale care. Use Tabula Medica's free care finder to locate the nearest clinic. For prescription savings, the drug savings finder at tabulamedica.health/drug-savings shows manufacturer assistance programs that don't require insurance.",
      },
      {
        question: "Does Texas have Medicaid expansion?",
        answer:
          "No. Texas is one of the few states that has not expanded Medicaid under the ACA. Adults without children typically do not qualify for Texas Medicaid regardless of income. Tabula Medica can help you find FQHC care and apply for CHIP (for children) or emergency Medicaid.",
      },
      {
        question: "Which Texas health systems work with Tabula Medica?",
        answer:
          "Tabula Medica connects to UT Health, Texas Health Resources, Baylor Scott & White, MD Anderson, Methodist Health System, Christus Health, and thousands of other Texas providers via SMART on FHIR. Enter your provider's name in the app to check connectivity.",
      },
      {
        question: "How much can I save on prescriptions in Texas without insurance?",
        answer:
          "Savings vary by drug. Tabula Medica's drug savings finder shows GoodRx prices, manufacturer patient assistance programs, and generic alternatives. For common medications like metformin or lisinopril, costs can be under $10/month through discount programs even without insurance.",
      },
    ],
  },
  florida: {
    slug: "florida",
    name: "Florida",
    abbreviation: "FL",
    description:
      "Free health clinics, drug savings, and HIPAA-compliant health record tools for Florida residents. Tabula Medica helps Florida patients manage records across Florida Blue, AdventHealth, and 3,000+ other FL providers.",
    complianceLaw: "FL SB 1734 / FHIPA",
    complianceSummary:
      "Florida's SB 1734 and the Florida Information Protection Act (FIPA) establish data privacy requirements. Florida also enacted a social media / health data privacy law covering consumer health data. Tabula Medica's zero-knowledge encryption model and explicit consent architecture are designed to comply with Florida's evolving privacy framework.",
    fqhcCount: 650,
    populationUninsured: "11.0%",
    medicaidExpansion: false,
    keyFacts: [
      "Florida has 650+ FQHC sites — especially concentrated in Miami-Dade, Broward, and Hillsborough counties.",
      "Florida did not expand Medicaid; the income gap means many adults earning above poverty level do not qualify.",
      "Tabula Medica supports Florida Blue (BCBS), AdventHealth, HCA Healthcare, BayCare, and other major FL networks.",
      "Florida's large Spanish-speaking population is well-served by Tabula Medica's 52-language support.",
    ],
    faqs: [
      {
        question: "Does Tabula Medica comply with Florida's health data privacy laws?",
        answer:
          "Yes. Tabula Medica's zero-knowledge encryption model, explicit patient consent requirements, and HIPAA-grade security are designed to comply with Florida's data privacy framework including FIPA. Patients control exactly which providers can access their records.",
      },
      {
        question: "Where can I find free care in Florida?",
        answer:
          "Florida has 650+ FQHC sites concentrated in the Miami-Dade, Broward, Palm Beach, and Hillsborough areas. Use the free care finder at tabulamedica.health/find-free-care to find the nearest FQHC by ZIP code. FQHCs offer medical, dental, and behavioral health on a sliding fee scale.",
      },
      {
        question: "Can Tabula Medica connect to my Florida Blue or AdventHealth records?",
        answer:
          "Yes. Tabula Medica connects to Florida Blue (BCBS of Florida), AdventHealth, HCA Healthcare Florida, BayCare Health System, UF Health, and thousands of other Florida providers. Connect your patient portal in the app for automatic record sync.",
      },
      {
        question: "Does Florida have Medicaid expansion?",
        answer:
          "No. Florida has not expanded Medicaid under the ACA, meaning adults without children with incomes above the poverty level generally do not qualify. Tabula Medica can help you identify FQHC care, charity programs, and drug savings programs available regardless of insurance status.",
      },
      {
        question: "Is the app available in Spanish for Florida's Hispanic community?",
        answer:
          "Yes. Tabula Medica supports Spanish and 51 other languages with full RTL rendering. Florida's large Spanish, Haitian Creole, and Portuguese-speaking communities can access all features in their preferred language.",
      },
    ],
  },
  "new-york": {
    slug: "new-york",
    name: "New York",
    abbreviation: "NY",
    description:
      "Free health clinics, drug savings, and HIPAA-compliant health record tools for New York residents. Tabula Medica integrates with NYC Health + Hospitals, NYU Langone, Northwell Health, and 5,000+ NY providers.",
    complianceLaw: "NY SHIELD / Consumer Health Data Law",
    complianceSummary:
      "New York's SHIELD Act and emerging consumer health data legislation establish strong privacy protections for New Yorkers' health information. Tabula Medica's end-to-end encryption, explicit consent model, and audit trail satisfy New York's security requirements. We track the evolving NY AI governance framework and update our controls accordingly.",
    fqhcCount: 900,
    populationUninsured: "5.5%",
    medicaidExpansion: true,
    keyFacts: [
      "New York has one of the lowest uninsured rates nationally at ~5.5% thanks to robust Medicaid expansion.",
      "NYC Health + Hospitals (11 hospitals, 70+ clinics) is FHIR-connected and among the most-used connections in Tabula Medica.",
      "NY Essential Plan covers adults from 138%–200% FPL with $0 premiums — Tabula Medica helps you track coverage eligibility.",
      "New York's SHIELD Act requires breach notification within 72 hours — Tabula Medica's incident response meets this requirement.",
    ],
    faqs: [
      {
        question: "Does Tabula Medica comply with New York's SHIELD Act?",
        answer:
          "Yes. New York's SHIELD Act requires reasonable data security safeguards and breach notification. Tabula Medica uses AES-256-GCM encryption, TLS 1.3 in transit, strict access controls, and audit logging. Our incident response plan includes 72-hour breach notification as required by the SHIELD Act.",
      },
      {
        question: "Can Tabula Medica connect to NYC Health + Hospitals or Northwell?",
        answer:
          "Yes. Tabula Medica connects to NYC Health + Hospitals, Northwell Health, NYU Langone, NewYork-Presbyterian, Mount Sinai Health System, and thousands of other NY providers via SMART on FHIR. Most major NY health systems are supported.",
      },
      {
        question: "I have NY Medicaid or the Essential Plan. Can Tabula Medica help?",
        answer:
          "Yes. New York's Medicaid expansion is among the most comprehensive in the US. Tabula Medica works with all NY Medicaid managed care plans and can connect records from any FHIR-enabled provider in the state, including community health centers that serve Medicaid patients.",
      },
      {
        question: "Where can I find free or low-cost care in New York City?",
        answer:
          "New York City has 900+ FQHC sites across all five boroughs. NYC Health + Hospitals offers care on a sliding fee scale regardless of insurance or immigration status. Use the free care finder at tabulamedica.health/find-free-care to find the nearest location.",
      },
      {
        question: "How is Tabula Medica addressing New York's AI governance requirements?",
        answer:
          "Tabula Medica monitors New York's developing AI governance framework and the proposed NY AI Consumer Protection Act. Our AI features already include explainability disclosures, human oversight mechanisms, and full audit logging — controls aligned with the AI governance principles New York is codifying.",
      },
    ],
  },
  illinois: {
    slug: "illinois",
    name: "Illinois",
    abbreviation: "IL",
    description:
      "Free health clinics, drug savings, and HIPAA-compliant health record tools for Illinois residents. Tabula Medica connects to Northwestern Medicine, Rush, AMITA Health, and 5,000+ IL providers.",
    complianceLaw: "IL BIPA / IDHIPA",
    complianceSummary:
      "Illinois's Biometric Information Privacy Act (BIPA) is one of the strictest biometric data laws in the US. While BIPA covers biometric identifiers (fingerprints, facial recognition), its consent-first model reflects Illinois's broader privacy philosophy. Tabula Medica never collects biometric data and uses explicit, auditable patient consent for all data sharing. Illinois's evolving health data privacy framework under IDHIPA is monitored on an ongoing basis.",
    fqhcCount: 580,
    populationUninsured: "7.3%",
    medicaidExpansion: true,
    keyFacts: [
      "Illinois expanded Medicaid — adults up to 138% FPL qualify for free or low-cost coverage.",
      "580+ FQHC sites serve Chicago, the Metro East, and rural downstate communities.",
      "Northwestern Medicine, Rush University Medical Center, and Advocate Aurora Health are all FHIR-connected.",
      "Illinois's BIPA law underscores a strong privacy culture — Tabula Medica's consent-first model aligns with that standard.",
    ],
    faqs: [
      {
        question: "Does Tabula Medica comply with Illinois BIPA?",
        answer:
          "BIPA primarily governs biometric identifiers like fingerprints and facial scans. Tabula Medica does not collect biometric data. Our broader privacy architecture — explicit patient consent, audit logging, and zero-knowledge encryption — aligns with Illinois's strong privacy culture and any evolving health-specific privacy legislation.",
      },
      {
        question: "Can I connect my Northwestern Medicine or Rush records?",
        answer:
          "Yes. Tabula Medica connects to Northwestern Medicine, Rush University Medical Center, Advocate Aurora Health, AMITA Health, and thousands of other Illinois providers via SMART on FHIR. Search for your provider in the app to get started.",
      },
      {
        question: "Where can I find free care in Chicago or downstate Illinois?",
        answer:
          "Illinois has 580+ FQHC sites, including major community health networks in Chicago like Erie Family Health Centers and Community Health Center of Sangamon County downstate. Use the free care finder at tabulamedica.health/find-free-care to locate the nearest FQHC by ZIP code.",
      },
      {
        question: "Does Illinois have Medicaid expansion?",
        answer:
          "Yes. Illinois expanded Medicaid under the ACA. Adults with household income up to 138% of the Federal Poverty Level generally qualify for Illinois Medicaid (AllKids and adults). Tabula Medica can connect records from Illinois Medicaid managed care organizations.",
      },
      {
        question: "Is Tabula Medica available in Spanish for Illinois's Hispanic community?",
        answer:
          "Yes. Tabula Medica supports Spanish and 51 other languages. Illinois has a large Spanish-speaking and Polish-speaking community — all features are accessible in both languages with full interface translation.",
      },
    ],
  },
  georgia: {
    slug: "georgia",
    name: "Georgia",
    abbreviation: "GA",
    description:
      "Find free and low-cost clinics, drug savings, and health record resources for Georgia residents. Learn about community health centers, Georgia Pathways coverage, and medical record access.",
    complianceLaw: "GA O.C.G.A. § 31-33-2",
    complianceSummary:
      "Georgia's O.C.G.A. § 31-33-2 governs retention of medical records and furnishing copies to patients and authorized representatives. HIPAA also provides access and privacy protections for records held by covered providers. Request records from your provider's records office; availability through Tabula Medica depends on the provider's supported connection.",
    fqhcCount: 418,
    populationUninsured: "12.0% (2024 ACS)",
    medicaidExpansion: false,
    keyFacts: [
      "Georgia's all-ages uninsured rate was 12.0% in the 2024 American Community Survey.",
      "Georgia did not fully expand Medicaid; limited Pathways expansion covers a narrow income band with work requirements.",
      "HRSA's 2024 data reports 418 health center service delivery sites across Georgia.",
      "Search for your Georgia provider in the app to check whether a supported records connection is available.",
    ],
    faqs: [
      {
        question: "Does Georgia have Medicaid expansion?",
        answer:
          "Georgia has not adopted full ACA Medicaid expansion. Pathways to Coverage is a limited program for eligible adults ages 19–64 with income up to 100% of the federal poverty level and qualifying-activity requirements. Check pathways.georgia.gov for current rules and apply through Georgia Gateway. FQHCs offer sliding-scale care if you remain uninsured.",
      },
      {
        question: "Can Tabula Medica connect to Emory, Wellstar, or Grady records?",
        answer:
          "Search for your Georgia provider in the app to check for a supported SMART on FHIR connection. Availability varies by provider and portal. If Emory, Wellstar, Grady, or another provider is not listed, ask its records office about a patient access request under Georgia law and HIPAA.",
      },
      {
        question: "Where can I find free care in Georgia?",
        answer:
          "Georgia had 418 HRSA-funded health center service delivery sites in 2024. Networks include Southside Medical Center in Atlanta and Curtis V. Cooper Primary Health Care in Savannah. Use the free care finder by ZIP code and ask the clinic about its income-based sliding fee discount and available services.",
      },
      {
        question: "I'm uninsured in Georgia — what programs are available?",
        answer:
          "Options for uninsured Georgians include FQHCs (sliding-scale care), manufacturer prescription assistance programs, Grady Hospital's charity care program, and Georgia's Cancer Control Section programs. Tabula Medica's uninsured resources page at tabulamedica.health/uninsured-resources consolidates these options.",
      },
      {
        question: "What does Georgia law say about access to my medical records?",
        answer:
          "O.C.G.A. § 31-33-2 addresses furnishing medical records to patients and authorized people, subject to its requirements and exceptions. HIPAA also gives patients access rights at covered providers. Ask your provider's medical records office how to submit a request and what lawful copying fees may apply; connecting a portal does not replace these rights.",
      },
    ],
    sources: [
      { label: "Georgia patient record law", url: "https://gbd.georgia.gov/document/laws-policies-rules/patient-record-laws/download" },
      { label: "Georgia Pathways eligibility", url: "https://pathways.georgia.gov/eligibility" },
    ],
  },
  pennsylvania: {
    slug: "pennsylvania",
    name: "Pennsylvania",
    abbreviation: "PA",
    description:
      "Free health clinics, drug savings, and HIPAA-compliant health record tools for Pennsylvania residents. Tabula Medica connects to UPMC, Penn Medicine, Jefferson Health, and 6,000+ PA providers.",
    complianceLaw: "PA Medical Records Act",
    complianceSummary:
      "Pennsylvania's Medical Records Act (42 Pa. C.S. § 6151 et seq.) governs patient access to medical records. Pennsylvania patients have the right to access their records within 30 days of a written request. Tabula Medica's SMART on FHIR integration delivers records directly — no written request or waiting period needed. Pennsylvania's Breach of Personal Information Notification Act also applies to health data breaches.",
    fqhcCount: 620,
    populationUninsured: "5.7%",
    medicaidExpansion: true,
    keyFacts: [
      "Pennsylvania expanded Medicaid — adults up to 138% FPL qualify for Medical Assistance coverage.",
      "620+ FQHC sites serve Philadelphia, Pittsburgh, and rural Pennsylvania.",
      "UPMC, Penn Medicine, Jefferson Health, and Temple Health are all FHIR-connected.",
      "PA's low uninsured rate (~5.7%) reflects robust Medicaid + CHIP coverage — Tabula Medica helps patients navigate this complex system.",
    ],
    faqs: [
      {
        question: "What are my rights under Pennsylvania's Medical Records Act?",
        answer:
          "Pennsylvania law gives you the right to receive copies of your medical records within 30 days of a written request. Tabula Medica's SMART on FHIR connections provide your records instantly — no written request, no wait. You can also export your complete record at any time from the app.",
      },
      {
        question: "Can Tabula Medica connect to UPMC or Penn Medicine records?",
        answer:
          "Yes. Tabula Medica connects to UPMC, Penn Medicine, Jefferson Health, Temple Health, Tower Health, Geisinger, and thousands of other Pennsylvania providers via SMART on FHIR. Search for your provider in the app to connect.",
      },
      {
        question: "Does Pennsylvania have Medicaid expansion?",
        answer:
          "Yes. Pennsylvania expanded Medicaid under the ACA, covering adults up to 138% of the Federal Poverty Level. PA Medical Assistance (Medicaid) covers a broad set of services. Tabula Medica can connect records across all PA Medicaid managed care organizations.",
      },
      {
        question: "Where can I find free care in Pennsylvania?",
        answer:
          "Pennsylvania has 620+ FQHC sites including major networks in Philadelphia (Public Health Management Corporation) and Pittsburgh (Squirrel Hill Health Center, East End Community Health). Use tabulamedica.health/find-free-care to locate the nearest FQHC by ZIP code.",
      },
      {
        question: "How does Tabula Medica handle a Pennsylvania data breach?",
        answer:
          "Pennsylvania's Breach of Personal Information Notification Act requires notification within a reasonable time. In the event of any breach affecting PA residents, Tabula Medica follows HIPAA breach notification (60-day maximum) and PA law, whichever is stricter. Our incident response plan is audited annually.",
      },
    ],
  },
  ohio: {
    slug: "ohio",
    name: "Ohio",
    abbreviation: "OH",
    description:
      "Free health clinics, drug savings, and HIPAA-compliant health record tools for Ohio residents. Tabula Medica connects to Cleveland Clinic, OhioHealth, MetroHealth, and 5,000+ OH providers.",
    complianceLaw: "OH HB 10 AI Transparency",
    complianceSummary:
      "Ohio's HB 10 and developing AI transparency legislation reflect Ohio's active engagement with AI governance in healthcare. Tabula Medica's AI features include explainability disclosures, human oversight mechanisms, audit logging, and published model cards — controls aligned with the AI transparency principles Ohio is codifying. Ohio expanded Medicaid and has a large FQHC network.",
    fqhcCount: 490,
    populationUninsured: "6.5%",
    medicaidExpansion: true,
    keyFacts: [
      "Ohio expanded Medicaid — adults up to 138% FPL qualify for Ohio Medicaid coverage.",
      "490+ FQHC sites serve Cleveland, Columbus, Cincinnati, and Appalachian Ohio.",
      "Cleveland Clinic, OhioHealth, MetroHealth, and University Hospitals Cleveland are FHIR-connected.",
      "Ohio's HB 10 AI bill signals growing interest in AI transparency — Tabula Medica already publishes model cards and source citations for every AI output.",
    ],
    faqs: [
      {
        question: "Does Tabula Medica comply with Ohio's AI transparency requirements?",
        answer:
          "Yes. Tabula Medica publishes model cards for all AI features, labels every AI-generated clinical summary as AI-generated with source citations, and provides human oversight mechanisms. These controls align with Ohio's HB 10 AI transparency principles and any further AI governance legislation Ohio enacts.",
      },
      {
        question: "Can Tabula Medica connect to Cleveland Clinic or OhioHealth records?",
        answer:
          "Yes. Tabula Medica connects to Cleveland Clinic, OhioHealth, MetroHealth, University Hospitals Cleveland, Summa Health, Mercy Health, and thousands of other Ohio providers via SMART on FHIR. Search for your provider in the app to connect.",
      },
      {
        question: "Does Ohio have Medicaid expansion?",
        answer:
          "Yes. Ohio expanded Medicaid under the ACA, covering adults up to 138% of the Federal Poverty Level. Ohio Medicaid covers a broad set of services including dental and behavioral health. Tabula Medica can connect records from Ohio Medicaid managed care organizations.",
      },
      {
        question: "Where can I find free care in Ohio?",
        answer:
          "Ohio has 490+ FQHC sites including major networks in Cleveland (Care Alliance Health Center), Columbus (PrimaryOne Health), and Cincinnati (Caracole, Over-the-Rhine Community Health). Use tabulamedica.health/find-free-care to locate the nearest FQHC by ZIP code.",
      },
      {
        question: "How does Tabula Medica protect my health data in Ohio?",
        answer:
          "Tabula Medica uses AES-256-GCM encryption at rest, TLS 1.3 in transit, and a zero-knowledge key model where only you hold the decryption key for your PHI. Under the GCP Business Associate Agreement, all PHI is stored in HIPAA-covered GCP services. Ohio residents also benefit from federal HIPAA protections, which Tabula Medica fully implements.",
      },
    ],
  },
  arizona: {
    slug: "arizona",
    name: "Arizona",
    abbreviation: "AZ",
    description:
      "Find free and low-cost clinics, drug savings, and health record resources for Arizona residents. Learn about AHCCCS coverage, community health centers, and medical record privacy.",
    complianceLaw: "AZ A.R.S. § 12-2292",
    complianceSummary:
      "Arizona's A.R.S. § 12-2292 makes medical and payment records confidential unless disclosure is authorized by state or federal law or by the patient or authorized decision maker in writing. HIPAA protections also apply at covered providers. Ask your provider about authorization requirements before sharing records.",
    fqhcCount: 264,
    populationUninsured: "10.3% (2024 ACS)",
    medicaidExpansion: true,
    keyFacts: [
      "Arizona expanded Medicaid (AHCCCS) — adults up to 138% FPL qualify for state Medicaid coverage.",
      "HRSA's 2024 data reports 264 health center service delivery sites in Arizona.",
      "Search for your Arizona provider in the app to check supported record connections; availability varies by portal.",
      "Arizona's high rural population and tribal communities make FQHC access and multi-system records especially important.",
    ],
    faqs: [
      {
        question: "Does Arizona have Medicaid expansion?",
        answer:
          "Yes. Arizona's AHCCCS (Arizona Health Care Cost Containment System) expanded Medicaid under the ACA. Eligible adults ages 19–64 with income up to 138% of the federal poverty level may qualify, subject to other rules. Apply through AHCCCS or Health-e-Arizona Plus and check current requirements.",
      },
      {
        question: "Can Tabula Medica connect to Banner Health or Dignity Health Arizona records?",
        answer:
          "Search for Banner Health, Dignity Health Arizona, or your other provider in the app to check for a supported SMART on FHIR connection. Availability depends on the provider and portal. If a connection is unavailable, ask the provider's medical records office how to request your records.",
      },
      {
        question: "Where can I find free care in Arizona, especially in rural areas?",
        answer:
          "Arizona had 264 HRSA-funded health center service delivery sites in 2024. Networks include Mountain Park Health Center in Phoenix and El Rio Health in Tucson. Search the free care finder by ZIP code and confirm services, transportation options, and income-based sliding fees directly with the clinic.",
      },
      {
        question: "How does Arizona law protect medical record confidentiality?",
        answer:
          "A.R.S. § 12-2292 treats medical and payment records as confidential. Providers may disclose them as authorized by state or federal law or by written patient authorization. HIPAA also applies at covered providers. Ask your provider which authorization is needed for a particular disclosure; some disclosures are permitted or required without consent.",
      },
      {
        question: "I live in a rural area or on a Tribal reservation. Can Tabula Medica help?",
        answer:
          "Use the free care finder to search for nearby community health centers and contact the clinic to confirm availability. American Indian and Alaska Native residents can also check Indian Health Service or Tribal health programs directly; eligibility and services vary. AHCCCS enrollment may offer additional coverage, including through the American Indian Health Program for eligible members.",
      },
    ],
    sources: [
      { label: "Arizona medical record confidentiality law", url: "https://www.azleg.gov/ars/12/02292.htm" },
      { label: "AHCCCS eligibility", url: "https://www.azahcccs.gov/Members/GetCovered/" },
    ],
  },
  "north-carolina": {
    slug: "north-carolina",
    name: "North Carolina",
    abbreviation: "NC",
    description:
      "Find free and low-cost clinics, drug savings, and health record resources for North Carolina residents. Learn about NC Medicaid expansion, community health centers, and privacy protections.",
    complianceLaw: "NC Identity Theft Protection Act / Medicaid Expansion",
    complianceSummary:
      "North Carolina's Identity Theft Protection Act includes breach notification requirements under N.C. Gen. Stat. § 75-65 and disposal protections under § 75-64 for covered personal information. Whether a particular incident triggers notice depends on the law's definitions and exceptions; HIPAA obligations may also apply. NC Medicaid expansion began December 1, 2023.",
    fqhcCount: 622,
    populationUninsured: "8.6% (2024 ACS)",
    medicaidExpansion: true,
    keyFacts: [
      "North Carolina expanded Medicaid in December 2023 — up to 600,000 previously uninsured adults became newly eligible.",
      "HRSA's 2024 data reports 622 health center service delivery sites in North Carolina.",
      "Search for your North Carolina provider in the app to check supported records connections; availability varies by portal.",
      "NC's recent Medicaid expansion creates new opportunities for Tabula Medica to help newly enrolled patients consolidate their records.",
    ],
    faqs: [
      {
        question: "When did North Carolina expand Medicaid?",
        answer:
          "North Carolina expanded Medicaid on December 1, 2023. Eligible adults ages 19–64 with household income up to 138% of the federal poverty level may qualify, subject to residency, immigration, and other rules. Apply through NC ePASS or your local Department of Social Services; NC Medicaid makes the eligibility decision.",
      },
      {
        question: "Can Tabula Medica connect to UNC Health, Duke, or Atrium records?",
        answer:
          "Search for UNC Health, Duke, Atrium, or your other provider in the app to check for a supported SMART on FHIR connection. Availability varies by provider and patient portal. If your provider is not listed, contact its medical records office to request copies directly.",
      },
      {
        question: "Where can I find free care in North Carolina?",
        answer:
          "North Carolina had 622 HRSA-funded health center service delivery sites in 2024. Networks include Piedmont Health in the Triangle and Roanoke Chowan Community Health Center in eastern North Carolina. Search the free care finder by ZIP code and ask about income-based sliding fees. Free and charitable clinics may have separate eligibility rules.",
      },
      {
        question: "I just enrolled in NC Medicaid. Can Tabula Medica help me manage my records?",
        answer:
          "You can look for supported connections to prior and new North Carolina providers to organize available records in one timeline. A new NC Medicaid enrollment does not automatically transfer every prior record or guarantee portal support. Ask your new primary care clinic which records it needs and request missing copies from your former providers.",
      },
      {
        question: "How does Tabula Medica comply with the NC Identity Theft Protection Act?",
        answer:
          "The Identity Theft Protection Act addresses disposal of covered personal information (§ 75-64) and breach notification (§ 75-65). When state notice is required, it must be provided without unreasonable delay, subject to statutory exceptions; HIPAA's outer deadline is not a substitute for that requirement. See Tabula Medica's privacy policy for its data practices and contact information.",
      },
    ],
    sources: [
      { label: "NC breach notification law", url: "https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_75/GS_75-65.html" },
      { label: "NC Medicaid expansion and enrollment", url: "https://medicaid.ncdhhs.gov/questions-and-answers-about-medicaid-expansion" },
    ],
  },
  oklahoma: {
    slug: "oklahoma",
    name: "Oklahoma",
    abbreviation: "OK",
    description:
      "Find free and low-cost clinics, prescription savings, and health record tools for Oklahoma residents. Learn about SoonerCare expansion and community health centers serving Oklahoma City, Tulsa, and rural communities.",
    complianceLaw: "OK 76 O.S. § 19",
    complianceSummary:
      "Oklahoma's 76 O.S. § 19 gives patients access to medical records and addresses copies and fees, with exceptions including special rules for mental health and substance use treatment records. HIPAA access and privacy rules also apply at covered providers. Ask the records office about the process for your particular record.",
    fqhcCount: 196,
    populationUninsured: "11.5% (2024 ACS)",
    medicaidExpansion: true,
    keyFacts: [
      "Oklahoma expanded SoonerCare in July 2021 for eligible adults ages 19–64 with income up to 138% of the federal poverty level.",
      "HRSA's 2024 data reports 196 health center service delivery sites in Oklahoma.",
      "Community health centers serve uninsured patients using income-based sliding fee discounts.",
      "Tribal health programs and Indian Health Service facilities have their own eligibility rules; check with the facility directly.",
    ],
    faqs: [
      {
        question: "Does Oklahoma have Medicaid expansion through SoonerCare?",
        answer:
          "Yes. Oklahoma began SoonerCare expansion coverage July 1, 2021. Eligible adults ages 19–64 with household income up to 138% of the federal poverty level may qualify, subject to residency, immigration, and other rules. Apply through the Oklahoma Health Care Authority and check current eligibility requirements.",
      },
      {
        question: "Where can I find free or low-cost care in Oklahoma?",
        answer:
          "Oklahoma had 196 HRSA-funded health center service delivery sites in 2024. Examples include Variety Care in the Oklahoma City area and Community Health Connection in Tulsa. Use the free care finder by ZIP code and ask the clinic about sliding fee discounts based on household income and family size; not every visit is free.",
      },
      {
        question: "What are my medical record rights under Oklahoma law?",
        answer:
          "76 O.S. § 19 provides patient access to medical records and governs copies and fees. Mental health and substance use treatment records have separate rules, including 43A O.S. § 1-109. HIPAA may also govern your request at a covered provider. Contact the provider's records office rather than assuming all records can be released in the same way.",
      },
      {
        question: "Can I get care in Oklahoma while a SoonerCare application is pending?",
        answer:
          "Community health centers can see uninsured patients and offer income-based sliding fee discounts without requiring a completed SoonerCare enrollment. Ask about appointment availability, required income documents, and enrollment assistance. Tribal or Indian Health Service care may be another option for eligible people, but eligibility must be confirmed with that program.",
      },
      {
        question: "How can uninsured Oklahomans lower prescription costs?",
        answer:
          "Use the drug savings finder to compare discount options and manufacturer assistance programs. Ask your Oklahoma community health center whether it has an in-house or partner pharmacy and what discounts you qualify for. Prices and eligibility vary; a discount card is not insurance and generally cannot be combined with a SoonerCare payment.",
      },
    ],
    sources: [
      { label: "Oklahoma medical record access law", url: "https://law.justia.com/codes/oklahoma/title-76/section-76-19" },
      { label: "SoonerCare eligibility and enrollment", url: "https://oklahoma.gov/ohca/individuals/mysoonercare.html" },
    ],
  },
  mississippi: {
    slug: "mississippi",
    name: "Mississippi",
    abbreviation: "MS",
    description:
      "Find free and low-cost clinics, prescription savings, and health record resources for Mississippi residents. Explore sliding-scale community health centers and Mississippi Medicaid and CHIP options.",
    complianceLaw: "MS Code § 41-9-65",
    complianceSummary:
      "Mississippi Code § 41-9-65 treats hospital records as hospital property while providing reasonable access to their information upon good cause shown by patients and specified representatives, subject to reasonable charges. HIPAA also provides access and privacy rights at covered providers. Contact the hospital's records office about a request.",
    fqhcCount: 304,
    populationUninsured: "9.7% (2024 ACS)",
    medicaidExpansion: false,
    keyFacts: [
      "Mississippi has not adopted full ACA Medicaid expansion; low income alone does not establish adult eligibility.",
      "HRSA's 2024 data reports 304 health center service delivery sites in Mississippi.",
      "Mississippi Medicaid and CHIP cover eligible children; pregnancy, disability, and other categories have separate rules.",
      "Community health centers offer sliding-scale care in Jackson, the Delta, the Gulf Coast, and other underserved communities.",
    ],
    faqs: [
      {
        question: "Does Mississippi have Medicaid expansion?",
        answer:
          "Mississippi has not adopted full ACA Medicaid expansion. Eligibility depends on a covered group, income, and other requirements, such as pregnancy, parent or caretaker status, age, or disability. Some low-income adults remain in a coverage gap. Check the Mississippi Division of Medicaid for current rules; FQHCs can provide care even without insurance.",
      },
      {
        question: "Where can I find free or low-cost care in Mississippi?",
        answer:
          "Mississippi had 304 HRSA-funded health center service delivery sites in 2024. Examples include Jackson-Hinds Comprehensive Health Center and Delta Health Center in Mound Bayou. Search the free care finder by ZIP code, then ask about appointment availability and income-based sliding fees. Services and costs vary by clinic.",
      },
      {
        question: "What does Mississippi law say about access to hospital records?",
        answer:
          "Mississippi Code § 41-9-65 allows reasonable access to hospital record information upon good cause shown by patients and specified representatives, subject to reasonable charges. HIPAA access rights may also apply. Ask the hospital's medical records office how to request copies and authorize sharing; this hospital statute does not mean every record is publicly accessible.",
      },
      {
        question: "Can my children get coverage if I am uninsured in Mississippi?",
        answer:
          "Possibly. Mississippi Medicaid and the Children's Health Insurance Program (CHIP) have child-specific income and eligibility rules. A parent's lack of insurance does not by itself make a child ineligible. Apply through the Mississippi Division of Medicaid or ask a community health center for enrollment help; the state makes the eligibility decision.",
      },
      {
        question: "What help is available for prescriptions in rural Mississippi?",
        answer:
          "Ask your community health center about pharmacy services, sliding-scale discounts, and manufacturer patient assistance applications. The drug savings finder can help compare options, but eligibility, stock, and prices vary. Call the clinic or pharmacy before traveling from a rural or Delta community, and ask about delivery or transportation assistance.",
      },
    ],
    sources: [
      { label: "Mississippi hospital record access law", url: "https://law.justia.com/codes/mississippi/title-41/chapter-9/hospital-records-preparation-preservation-and-destruction/section-41-9-65" },
      { label: "Mississippi Medicaid and CHIP eligibility", url: "https://medicaid.ms.gov/medicaid-coverage/who-qualifies-for-coverage/" },
    ],
  },
  missouri: {
    slug: "missouri",
    name: "Missouri",
    abbreviation: "MO",
    description:
      "Find free and low-cost clinics, prescription savings, and health record tools for Missouri residents. Learn about MO HealthNet expansion and community health centers in St. Louis, Kansas City, and the Ozarks.",
    complianceLaw: "MO RSMo § 191.227",
    complianceSummary:
      "Missouri's RSMo § 191.227 addresses furnishing medical records on written request by patients and authorized representatives, with statutory limitations and fee rules. HIPAA access rules may also apply at covered providers. Request copies from the provider's records office and ask which fee limits apply to your request.",
    fqhcCount: 430,
    populationUninsured: "7.7% (2024 ACS)",
    medicaidExpansion: true,
    keyFacts: [
      "Missouri implemented Medicaid expansion in 2021 through MO HealthNet for eligible adults ages 19–64 up to 138% of the federal poverty level.",
      "HRSA's 2024 data reports 430 health center service delivery sites in Missouri.",
      "Missouri's all-ages uninsured rate was 7.7% in the 2024 American Community Survey.",
      "Community health centers serve both urban neighborhoods and rural Ozarks communities with income-based sliding fees.",
    ],
    faqs: [
      {
        question: "Does Missouri have Medicaid expansion through MO HealthNet?",
        answer:
          "Yes. Missouri implemented Medicaid expansion in 2021. Eligible adults ages 19–64 with income up to 138% of the federal poverty level may qualify for MO HealthNet, subject to other eligibility rules. Apply through myDSS or the Missouri Family Support Division and check current requirements; Tabula Medica does not determine eligibility.",
      },
      {
        question: "Where can I find free or low-cost care in Missouri?",
        answer:
          "Missouri had 430 HRSA-funded health center service delivery sites in 2024. Examples include Affinia Healthcare in St. Louis, Swope Health in Kansas City, and Jordan Valley Community Health Center in southwest Missouri. Use the free care finder by ZIP code and ask about income-based sliding fees, services, and appointments.",
      },
      {
        question: "What rights do I have under Missouri's medical records law?",
        answer:
          "RSMo § 191.227 requires covered providers to furnish medical records on written request by a patient or authorized representative, subject to statutory limitations and fees. HIPAA may also apply and can limit charges for patient access. Ask your provider's records office for its request process; a portal connection does not guarantee every record is available electronically.",
      },
      {
        question: "Can I use a Missouri community health center without MO HealthNet?",
        answer:
          "Yes. FQHCs serve uninsured patients as well as people with Medicaid, Medicare, and private insurance. Ask about the center's sliding fee discount application and what income or household-size documentation to bring. Staff may also help you apply for MO HealthNet or review marketplace options; enrollment is not required just to ask for care.",
      },
      {
        question: "How can rural Missouri residents get prescription savings?",
        answer:
          "Use the drug savings finder to compare discount options and manufacturer assistance, and ask your local Ozarks or other rural community health center about pharmacy services. Availability and costs differ by location. Call before traveling and confirm whether a program works with your insurance or requires an uninsured application.",
      },
    ],
    sources: [
      { label: "Missouri medical record access law", url: "https://revisor.mo.gov/main/OneSection.aspx?section=191.227" },
      { label: "MO HealthNet eligibility and enrollment", url: "https://mydss.mo.gov/healthcare" },
    ],
  },
};

interface GeoLandingProps {
  stateSlug: string;
}

export default function GeoLanding({ stateSlug }: GeoLandingProps) {
  const config = STATE_CONFIGS[stateSlug];

  if (!config) {
    return (
      <div className="container mx-auto py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">State Not Found</h1>
        <p className="text-muted-foreground">
          We don't have a page for that state yet.
        </p>
        <Link href="/">
          <Button className="mt-6">Back to Home</Button>
        </Link>
      </div>
    );
  }

  useSeoMeta({
    title: `Health Resources in ${config.name}`,
    description: config.description,
    canonicalPath: `/care/${config.slug}`,
    structuredData: [
      buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: `${config.name} Health Resources`, path: `/care/${config.slug}` },
      ]),
      buildMedicalWebPageSchema({
        name: `Health Records & Free Care Resources in ${config.name}`,
        description: config.description,
        path: `/care/${config.slug}`,
        medicalAudience: "Patient",
      }),
      buildFAQSchema(config.faqs),
    ],
  });

  return (
    <div className="min-h-screen bg-background">
      {/* AEO Quick Answer block */}
      <section
        className="bg-primary/5 border-b px-4 py-3"
        itemScope
        itemType="https://schema.org/Answer"
      >
        <div className="container mx-auto max-w-4xl">
          <p className="text-sm text-muted-foreground" itemProp="text">
            <strong>Quick answer:</strong> Tabula Medica provides free health
            tools for {config.name} residents — including a symptom checker,
            drug savings finder, and locator for {config.fqhcCount.toLocaleString()}+
            community health center sites — with information about {config.complianceLaw}.
            No account required for free tools.
          </p>
        </div>
      </section>

      {/* Hero */}
      <div className="bg-gradient-to-b from-blue-50 to-background dark:from-blue-950/20 dark:to-background px-4 py-12">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="secondary">
              <MapPin className="h-3 w-3 mr-1" />
              {config.name}
            </Badge>
            <Badge variant="outline" className="text-green-700 border-green-300">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {config.complianceLaw}
            </Badge>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Health Resources in {config.name}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mb-8">
            {config.description}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/find-free-care">
              <Button size="lg">
                <Heart className="h-4 w-4 mr-2" />
                Find Free Care Near You
              </Button>
            </Link>
            <Link href="/drug-savings">
              <Button variant="outline" size="lg">
                <DollarSign className="h-4 w-4 mr-2" />
                Drug Savings Finder
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-4xl px-4 py-10 space-y-10">
        {/* Key stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-primary">
                {config.fqhcCount.toLocaleString()}+
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Community Health Center Sites
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-primary">
                {config.populationUninsured}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Uninsured Rate
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-primary">
                {config.medicaidExpansion ? "Yes" : "No"}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Medicaid Expansion
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Compliance section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {config.complianceLaw} — State Context
            </CardTitle>
            <CardDescription>
              Medical record rights and privacy information for {config.name} residents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">
              {config.complianceSummary}
            </p>
          </CardContent>
        </Card>

        {/* Key facts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              Key Facts for {config.name} Residents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {config.keyFacts.map((fact, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground text-sm">{fact}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Free tools CTA cards */}
        <div>
          <h2 className="text-2xl font-bold mb-4">
            Free Tools for {config.name} Residents
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Heart className="h-4 w-4 text-red-500" />
                  Find Free & Low-Cost Care
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Locate a nearby FQHC in {config.name}. Ask the clinic about
                  sliding fees and any documents needed for care or coverage.
                </p>
                <Link href="/find-free-care">
                  <Button variant="outline" size="sm" className="w-full">
                    Find Clinics
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  Drug Savings Finder
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Compare prescription prices and find manufacturer assistance
                  programs available in {config.name}.
                </p>
                <Link href="/drug-savings">
                  <Button variant="outline" size="sm" className="w-full">
                    Find Savings
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  Find a Doctor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Search for providers in {config.name} by specialty,
                  location, and accepted insurance — including self-pay.
                </p>
                <Link href="/care/find-a-doctor">
                  <Button variant="outline" size="sm" className="w-full">
                    Search Providers
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-purple-600" />
                  Insurance Learning Center
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Plain-language lessons on premiums, deductibles, copays, and
                  {config.name}-specific marketplace options.
                </p>
                <Link href="/insurance-learning">
                  <Button variant="outline" size="sm" className="w-full">
                    Start Learning
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-2xl font-bold mb-6">
            Frequently Asked Questions — {config.name}
          </h2>
          <div className="space-y-4">
            {config.faqs.map((faq, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">
                    {faq.question}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {config.sources && (
          <section aria-label="Sources and enrollment information" className="text-sm text-muted-foreground">
            <h2 className="text-lg font-semibold mb-3">Sources &amp; enrollment information</h2>
            <p className="mb-3">
              Site counts are from 2024 HRSA-funded health center data (not a guarantee
              of finder coverage); uninsured rates are all-ages 2024 ACS estimates.
              Sliding-scale care is not always free. Eligibility and laws can change.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              {[
                ...config.sources,
                { label: "HRSA health center sites (KFF, 2024 table)", url: "https://www.kff.org/state-health-policy-data/state-indicator/community-health-center-sites-and-visits/" },
                { label: "Census uninsured rates, 2024 ACS (Appendix Table 2)", url: "https://www2.census.gov/library/publications/2025/demo/acsbr-024.pdf" },
              ].map((source) => (
                <li key={source.url}>
                  <a className="underline" href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* App CTA */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-8 text-center">
            <Brain className="h-10 w-10 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">
              Get Your Complete Health Record — Free
            </h3>
            <p className="text-muted-foreground max-w-lg mx-auto mb-6">
              Connect every {config.name} hospital and clinic into one secure,
              deduplicated timeline. No faxes. No phone calls. Instant.
            </p>
            <div className="flex justify-center gap-3 flex-wrap">
              <Link href="/auth/register">
                <Button size="lg">
                  Create Free Account
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Link href="/try">
                <Button variant="outline" size="lg">
                  Try Instant Analysis
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
