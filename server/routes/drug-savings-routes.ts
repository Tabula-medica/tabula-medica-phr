import { Router } from "express";
import { generatePhiSafeText } from "../services/ai-gateway";

const router = Router();

interface ManufacturerProgram {
  id: string;
  manufacturer: string;
  programName: string;
  description: string;
  url: string;
  eligibility: string;
  coveredMedications: string[];
  savingsEstimate: string;
}

interface ExternalResource {
  id: string;
  name: string;
  description: string;
  url: string;
  type: string;
}

interface GenericAlternative {
  brandName: string;
  genericName: string;
  estimatedSavings: string;
  notes: string;
}

const manufacturerPrograms: ManufacturerProgram[] = [
  {
    id: "lilly-cares",
    manufacturer: "Eli Lilly",
    programName: "Lilly Cares Foundation",
    description: "Provides free Lilly medications to qualifying patients who lack prescription drug coverage.",
    url: "https://www.lillycares.com",
    eligibility: "Uninsured or underinsured patients at or below 400% FPL",
    coveredMedications: ["Humalog", "Humulin", "Trulicity", "Verzenio", "Jardiance", "Mounjaro", "Zepbound"],
    savingsEstimate: "Up to 100% off",
  },
  {
    id: "pfizer-rxpathways",
    manufacturer: "Pfizer",
    programName: "Pfizer RxPathways",
    description: "Connects patients to a range of assistance programs including insurance support and co-pay cards.",
    url: "https://www.pfizerrxpathways.com",
    eligibility: "Varies by program; income-based for PAP",
    coveredMedications: ["Eliquis", "Ibrance", "Xeljanz", "Prevnar", "Paxlovid", "Comirnaty"],
    savingsEstimate: "Co-pay as low as $0",
  },
  {
    id: "novocare",
    manufacturer: "Novo Nordisk",
    programName: "NovoCare",
    description: "Patient assistance programs for Novo Nordisk diabetes and obesity medications.",
    url: "https://www.novocare.com",
    eligibility: "Uninsured patients; income requirements vary",
    coveredMedications: ["Ozempic", "Wegovy", "Rybelsus", "Levemir", "NovoLog", "Victoza", "Saxenda"],
    savingsEstimate: "Up to 100% off for qualifying patients",
  },
  {
    id: "abbvie-myaccess",
    manufacturer: "AbbVie",
    programName: "myAbbVie Assist",
    description: "Free medications for eligible patients without insurance or with coverage gaps.",
    url: "https://www.abbvie.com/patients/patient-assistance.html",
    eligibility: "Uninsured or underinsured; income-based",
    coveredMedications: ["Humira", "Skyrizi", "Rinvoq", "Imbruvica", "Venclexta", "Vraylar"],
    savingsEstimate: "Up to 100% off",
  },
  {
    id: "merck-helps",
    manufacturer: "Merck",
    programName: "Merck Patient Assistance Program",
    description: "Provides Merck medicines at no cost for people who qualify.",
    url: "https://www.merckhelps.com",
    eligibility: "No insurance or limited coverage; income at or below 400% FPL",
    coveredMedications: ["Keytruda", "Januvia", "Janumet", "Gardasil", "Isentress", "Bridion"],
    savingsEstimate: "Free medications for qualifying patients",
  },
  {
    id: "bms-access",
    manufacturer: "Bristol-Myers Squibb",
    programName: "BMS Access Support",
    description: "Comprehensive support including financial assistance, co-pay help, and free drug programs.",
    url: "https://www.bmsaccesssupport.bmscustomerconnect.com",
    eligibility: "Varies by product; income-based for PAP",
    coveredMedications: ["Opdivo", "Eliquis", "Revlimid", "Pomalyst", "Orencia", "Zeposia"],
    savingsEstimate: "Co-pay as low as $0-$10",
  },
  {
    id: "jnj-patient-assistance",
    manufacturer: "Johnson & Johnson",
    programName: "J&J Patient Assistance Foundation",
    description: "Provides free J&J medications to eligible patients without adequate insurance.",
    url: "https://www.jjpaf.org",
    eligibility: "Uninsured or underinsured; income at or below 500% FPL",
    coveredMedications: ["Stelara", "Tremfya", "Darzalex", "Erleada", "Imbruvica", "Xarelto"],
    savingsEstimate: "Up to 100% off",
  },
  {
    id: "astrazeneca-azme",
    manufacturer: "AstraZeneca",
    programName: "AZ&Me Prescription Savings",
    description: "Free AstraZeneca medications for patients who qualify based on financial need.",
    url: "https://www.azandmeapp.com",
    eligibility: "No prescription coverage; income at or below 400% FPL",
    coveredMedications: ["Farxiga", "Symbicort", "Lynparza", "Tagrisso", "Imfinzi", "Brilinta"],
    savingsEstimate: "Up to 100% off",
  },
  {
    id: "sanofi-patient-connection",
    manufacturer: "Sanofi",
    programName: "Sanofi Patient Connection",
    description: "Helps eligible patients get Sanofi medications at no cost.",
    url: "https://www.sanofipatientconnection.com",
    eligibility: "Uninsured; income-based eligibility",
    coveredMedications: ["Dupixent", "Lantus", "Toujeo", "Praluent", "Aubagio", "Kevzara"],
    savingsEstimate: "Free medications for qualifying patients",
  },
  {
    id: "boehringer-cares",
    manufacturer: "Boehringer Ingelheim",
    programName: "Boehringer Ingelheim Cares Foundation",
    description: "Patient assistance program providing free medications to qualifying individuals.",
    url: "https://www.boehringer-ingelheim.com/us/our-responsibility/patient-assistance-program",
    eligibility: "No insurance; income at or below 300% FPL",
    coveredMedications: ["Jardiance", "Ofev", "Spiriva", "Praxbind", "Stiolto"],
    savingsEstimate: "Up to 100% off",
  },
];

const externalResources: ExternalResource[] = [
  {
    id: "goodrx",
    name: "GoodRx",
    description: "Compare prescription drug prices and find free coupons accepted at over 70,000 pharmacies.",
    url: "https://www.goodrx.com",
    type: "price-comparison",
  },
  {
    id: "rxassist",
    name: "RxAssist",
    description: "Comprehensive database of patient assistance programs and practical tools for providers and patients.",
    url: "https://www.rxassist.org",
    type: "assistance-directory",
  },
  {
    id: "needymeds",
    name: "NeedyMeds",
    description: "Free information on programs that help people who cannot afford their medications and healthcare costs.",
    url: "https://www.needymeds.org",
    type: "assistance-directory",
  },
  {
    id: "rxsaver",
    name: "RxSaver by RetailMeNot",
    description: "Search for prescription drug coupons and compare prices at nearby pharmacies.",
    url: "https://www.rxsaver.com",
    type: "price-comparison",
  },
  {
    id: "costplusdrugs",
    name: "Mark Cuban Cost Plus Drugs",
    description: "Online pharmacy offering transparent pricing with a standard 15% markup plus $3 pharmacy fee and $5 shipping.",
    url: "https://costplusdrugs.com",
    type: "pharmacy",
  },
  {
    id: "340b",
    name: "340B Drug Pricing Program",
    description: "Federal program that requires drug manufacturers to provide discounted medications to eligible healthcare organizations.",
    url: "https://www.hrsa.gov/opa",
    type: "federal-program",
  },
];

const genericAlternatives: GenericAlternative[] = [
  { brandName: "Lipitor", genericName: "Atorvastatin", estimatedSavings: "Save up to 90%", notes: "Widely available generic since 2011" },
  { brandName: "Crestor", genericName: "Rosuvastatin", estimatedSavings: "Save up to 85%", notes: "Generic available since 2016" },
  { brandName: "Zoloft", genericName: "Sertraline", estimatedSavings: "Save up to 90%", notes: "Generic available since 2006" },
  { brandName: "Lexapro", genericName: "Escitalopram", estimatedSavings: "Save up to 90%", notes: "Generic available since 2012" },
  { brandName: "Prilosec", genericName: "Omeprazole", estimatedSavings: "Save up to 85%", notes: "Available OTC and as generic" },
  { brandName: "Nexium", genericName: "Esomeprazole", estimatedSavings: "Save up to 80%", notes: "OTC and generic versions available" },
  { brandName: "Singulair", genericName: "Montelukast", estimatedSavings: "Save up to 85%", notes: "Generic available since 2012" },
  { brandName: "Glucophage", genericName: "Metformin", estimatedSavings: "Save up to 90%", notes: "First-line diabetes medication, widely available" },
  { brandName: "Norvasc", genericName: "Amlodipine", estimatedSavings: "Save up to 90%", notes: "Generic available since 2007" },
  { brandName: "Synthroid", genericName: "Levothyroxine", estimatedSavings: "Save up to 80%", notes: "Generic available; discuss with doctor as formulations may differ" },
  { brandName: "Zocor", genericName: "Simvastatin", estimatedSavings: "Save up to 90%", notes: "Long-available generic" },
  { brandName: "Proventil/Ventolin", genericName: "Albuterol", estimatedSavings: "Save up to 70%", notes: "Authorized generic inhalers available" },
];

const patientAssistanceInfo = {
  title: "Patient Assistance Programs (PAPs)",
  description: "Patient Assistance Programs are run by pharmaceutical companies to provide free or low-cost medications to people who are unable to afford them.",
  howToApply: [
    "Talk to your doctor about which medications you need",
    "Check if the manufacturer offers a PAP for that medication",
    "Gather required documents (proof of income, prescription, insurance status)",
    "Complete the application with your healthcare provider",
    "Applications are typically reviewed within 4-6 weeks",
  ],
  eligibilityTips: [
    "Most programs require income at or below 200-500% of Federal Poverty Level (FPL)",
    "You typically must be a U.S. resident",
    "You must have a valid prescription from a licensed provider",
    "Some programs accept patients with insurance if out-of-pocket costs are too high",
    "Medicare Part D patients in the coverage gap may qualify for some programs",
  ],
};

router.get("/manufacturer-programs", (req, res) => {
  const search = (req.query.search as string || "").toLowerCase();
  let results = manufacturerPrograms;
  if (search) {
    results = manufacturerPrograms.filter(
      (p) =>
        p.manufacturer.toLowerCase().includes(search) ||
        p.programName.toLowerCase().includes(search) ||
        p.coveredMedications.some((m) => m.toLowerCase().includes(search))
    );
  }
  res.json({ programs: results });
});

router.get("/external-resources", (_req, res) => {
  res.json({ resources: externalResources });
});

router.get("/generic-alternatives", (req, res) => {
  const search = (req.query.search as string || "").toLowerCase();
  let results = genericAlternatives;
  if (search) {
    results = genericAlternatives.filter(
      (g) =>
        g.brandName.toLowerCase().includes(search) ||
        g.genericName.toLowerCase().includes(search)
    );
  }
  res.json({ alternatives: results });
});

router.get("/pap-info", (_req, res) => {
  res.json(patientAssistanceInfo);
});

router.get("/search", (req, res) => {
  const search = (req.query.q as string || "").toLowerCase();
  if (!search) {
    return res.json({ programs: manufacturerPrograms, alternatives: genericAlternatives, resources: externalResources });
  }

  const matchingPrograms = manufacturerPrograms.filter(
    (p) =>
      p.manufacturer.toLowerCase().includes(search) ||
      p.programName.toLowerCase().includes(search) ||
      p.coveredMedications.some((m) => m.toLowerCase().includes(search))
  );

  const matchingAlternatives = genericAlternatives.filter(
    (g) =>
      g.brandName.toLowerCase().includes(search) ||
      g.genericName.toLowerCase().includes(search)
  );

  res.json({ programs: matchingPrograms, alternatives: matchingAlternatives, resources: externalResources });
});

router.get("/savings-summary", (_req, res) => {
  const totalPrograms = manufacturerPrograms.length;
  const totalGenerics = genericAlternatives.length;
  const totalResources = externalResources.length;
  const totalMedsCovered = new Set(manufacturerPrograms.flatMap(p => p.coveredMedications)).size;

  res.json({
    totalPrograms,
    totalGenerics,
    totalResources,
    totalMedsCovered,
    topSavings: [
      { category: "Generic Substitution", averageSavings: "80-90%", description: "Switch from brand to generic" },
      { category: "Patient Assistance Programs", averageSavings: "Up to 100%", description: "Free medications for qualifying patients" },
      { category: "Manufacturer Copay Cards", averageSavings: "$0-$10 copay", description: "Reduced out-of-pocket for insured patients" },
      { category: "340B Drug Pricing", averageSavings: "25-50%", description: "Discounted drugs at eligible facilities" },
      { category: "Mail-Order Pharmacy", averageSavings: "10-30%", description: "90-day supplies at reduced rates" },
    ],
  });
});

router.post("/ai-compare", async (req, res) => {
  try {
    const { medication, currentCost } = req.body;
    if (!medication) {
      return res.status(400).json({ error: "medication is required" });
    }

    const matchingGeneric = genericAlternatives.find(
      g => g.brandName.toLowerCase() === medication.toLowerCase() || g.genericName.toLowerCase() === medication.toLowerCase()
    );

    const matchingPrograms = manufacturerPrograms.filter(
      p => p.coveredMedications.some(m => m.toLowerCase().includes(medication.toLowerCase()))
    );

    const advice = await generatePhiSafeText({
      system: `You are a pharmaceutical savings advisor for Tabula Medica. Help patients find the most affordable options for their medications. Provide practical, actionable advice. Always include a disclaimer that this is informational only and not medical advice. Keep responses concise (3-4 paragraphs). Format savings tips as a numbered list.`,
      user: `I'm looking for ways to save on "${medication}"${currentCost ? ` (currently paying ~$${currentCost}/month)` : ""}. ${matchingGeneric ? `I found a generic alternative: ${matchingGeneric.genericName} (${matchingGeneric.estimatedSavings}).` : ""} ${matchingPrograms.length > 0 ? `Available assistance programs: ${matchingPrograms.map(p => p.programName).join(", ")}.` : ""} What are my best options to reduce costs?`,
      temperature: 0.5,
      maxTokens: 600,
    });

    res.json({
      advice: advice || "Unable to generate comparison.",
      genericAlternative: matchingGeneric || null,
      assistancePrograms: matchingPrograms,
      disclaimer: "This is informational only and does not constitute medical or pharmaceutical advice. Always consult your doctor before switching medications.",
    });
  } catch (error: any) {
    console.error("[DrugSavings] AI compare error:", error.message);
    res.json({
      advice: "AI comparison is temporarily unavailable. Please browse the manufacturer programs and generic alternatives tabs for savings options.",
      genericAlternative: null,
      assistancePrograms: [],
      disclaimer: "This is informational only.",
    });
  }
});

export default router;
