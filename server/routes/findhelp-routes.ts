import { Router } from "express";

const router = Router();

interface SDoHResource {
  id: string;
  name: string;
  organizationName: string;
  category: SDoHCategory;
  description: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  website: string;
  distance: number;
  eligibility: string[];
  hours: string;
  languages: string[];
  acceptsUninsured: boolean;
  slidingScale: boolean;
  freeServices: boolean;
  lastVerified: string;
  rating: number;
  servicesOffered: string[];
}

type SDoHCategory =
  | "healthcare"
  | "food"
  | "housing"
  | "transportation"
  | "financial"
  | "legal"
  | "education"
  | "employment"
  | "mental-health"
  | "substance-use"
  | "childcare"
  | "utilities";

interface FindHelpSearchResult {
  query: {
    zipCode: string;
    category: string | null;
    radius: number;
  };
  totalResults: number;
  resources: SDoHResource[];
  categories: { category: SDoHCategory; count: number; label: string }[];
  lastUpdated: string;
}

const CATEGORY_LABELS: Record<SDoHCategory, string> = {
  healthcare: "Healthcare & Clinics",
  food: "Food Assistance",
  housing: "Housing & Shelter",
  transportation: "Transportation",
  financial: "Financial Assistance",
  legal: "Legal Aid",
  education: "Education & Literacy",
  employment: "Employment & Job Training",
  "mental-health": "Mental Health & Counseling",
  "substance-use": "Substance Use Recovery",
  childcare: "Childcare & Family Support",
  utilities: "Utility Assistance",
};

function generateResourcesForZip(zipCode: string, category: SDoHCategory | null, radius: number): SDoHResource[] {
  const zipNum = parseInt(zipCode.slice(0, 3)) || 100;
  const stateMap: Record<number, { state: string; cities: string[] }> = {
    1: { state: "NY", cities: ["New York", "Brooklyn", "Bronx", "Queens"] },
    2: { state: "VA", cities: ["Arlington", "Alexandria", "Richmond", "Norfolk"] },
    3: { state: "FL", cities: ["Miami", "Orlando", "Tampa", "Jacksonville"] },
    4: { state: "GA", cities: ["Atlanta", "Savannah", "Augusta", "Macon"] },
    5: { state: "TX", cities: ["Houston", "Dallas", "Austin", "San Antonio"] },
    6: { state: "IL", cities: ["Chicago", "Springfield", "Naperville", "Rockford"] },
    7: { state: "OK", cities: ["Oklahoma City", "Tulsa", "Norman", "Broken Arrow"] },
    8: { state: "CO", cities: ["Denver", "Boulder", "Colorado Springs", "Aurora"] },
    9: { state: "CA", cities: ["Los Angeles", "San Francisco", "San Diego", "Sacramento"] },
    0: { state: "MA", cities: ["Boston", "Cambridge", "Worcester", "Springfield"] },
  };
  const region = stateMap[zipNum % 10] || stateMap[1]!;

  const allResources: SDoHResource[] = [
    {
      id: `fh-${zipCode}-hc-1`,
      name: `${region.cities[0]} Community Health Center`,
      organizationName: "National Association of Community Health Centers",
      category: "healthcare",
      description: "Federally Qualified Health Center (FQHC) providing primary care, dental, behavioral health, and pharmacy services on a sliding-fee scale regardless of insurance status or ability to pay.",
      address: `${100 + zipNum} Main Street`,
      city: region.cities[0]!,
      state: region.state,
      zipCode,
      phone: `(${zipCode.slice(0, 3)}) 555-0100`,
      website: "https://findahealthcenter.hrsa.gov",
      distance: 1.2,
      eligibility: ["No insurance required", "Sliding-fee scale based on income", "All ages accepted"],
      hours: "Mon-Fri 8:00 AM - 6:00 PM, Sat 9:00 AM - 1:00 PM",
      languages: ["English", "Spanish", "Mandarin"],
      acceptsUninsured: true,
      slidingScale: true,
      freeServices: false,
      lastVerified: "2026-03-15",
      rating: 4.6,
      servicesOffered: ["Primary Care", "Dental", "Behavioral Health", "Pharmacy", "Lab Services", "Women's Health", "Pediatrics"],
    },
    {
      id: `fh-${zipCode}-hc-2`,
      name: `${region.cities[1]} Free Clinic`,
      organizationName: "National Association of Free & Charitable Clinics",
      category: "healthcare",
      description: "Volunteer-staffed free clinic providing medical, dental, and mental health services to uninsured and underinsured individuals at no cost.",
      address: `${200 + zipNum} Oak Avenue`,
      city: region.cities[1]!,
      state: region.state,
      zipCode,
      phone: `(${zipCode.slice(0, 3)}) 555-0200`,
      website: "https://nafcclinics.org",
      distance: 2.8,
      eligibility: ["Must be uninsured or underinsured", "Income below 200% FPL", "Must live in service area"],
      hours: "Tue & Thu 5:00 PM - 9:00 PM, Sat 8:00 AM - 12:00 PM",
      languages: ["English", "Spanish"],
      acceptsUninsured: true,
      slidingScale: false,
      freeServices: true,
      lastVerified: "2026-02-28",
      rating: 4.8,
      servicesOffered: ["Primary Care", "Dental Cleanings", "Mental Health Counseling", "Chronic Disease Management", "Health Screenings"],
    },
    {
      id: `fh-${zipCode}-hc-3`,
      name: `${region.state} Planned Parenthood Health Center`,
      organizationName: "Planned Parenthood Federation of America",
      category: "healthcare",
      description: "Reproductive and sexual health services including annual exams, STI testing, contraception, cancer screenings, and hormone therapy. Sliding scale available.",
      address: `${350 + zipNum} Health Parkway`,
      city: region.cities[0]!,
      state: region.state,
      zipCode,
      phone: `(${zipCode.slice(0, 3)}) 555-0350`,
      website: "https://www.plannedparenthood.org",
      distance: 3.1,
      eligibility: ["All patients welcome", "Sliding scale based on income", "No insurance required"],
      hours: "Mon-Fri 9:00 AM - 5:00 PM",
      languages: ["English", "Spanish", "French"],
      acceptsUninsured: true,
      slidingScale: true,
      freeServices: false,
      lastVerified: "2026-03-20",
      rating: 4.5,
      servicesOffered: ["Annual Exams", "STI Testing & Treatment", "Contraception", "Cancer Screenings", "Hormone Therapy", "PrEP"],
    },
    {
      id: `fh-${zipCode}-fd-1`,
      name: `${region.cities[0]} Food Bank`,
      organizationName: "Feeding America",
      category: "food",
      description: "Emergency food distribution including fresh produce, dairy, protein, and pantry staples. No documentation required. Drive-through and walk-up available.",
      address: `${300 + zipNum} Elm Street`,
      city: region.cities[0]!,
      state: region.state,
      zipCode,
      phone: `(${zipCode.slice(0, 3)}) 555-0300`,
      website: "https://www.feedingamerica.org/find-your-local-foodbank",
      distance: 0.8,
      eligibility: ["No ID required", "No income verification", "Self-declared need"],
      hours: "Mon, Wed, Fri 9:00 AM - 3:00 PM",
      languages: ["English", "Spanish"],
      acceptsUninsured: true,
      slidingScale: false,
      freeServices: true,
      lastVerified: "2026-03-22",
      rating: 4.7,
      servicesOffered: ["Emergency Food Boxes", "Fresh Produce", "Baby Formula & Diapers", "Senior Meal Boxes", "SNAP Application Help"],
    },
    {
      id: `fh-${zipCode}-fd-2`,
      name: "WIC Office — Women, Infants & Children",
      organizationName: "USDA Food and Nutrition Service",
      category: "food",
      description: "Federal nutrition program for pregnant women, new mothers, infants, and children up to age 5. Provides supplemental foods, nutrition education, and healthcare referrals.",
      address: `${450 + zipNum} Government Center`,
      city: region.cities[2]!,
      state: region.state,
      zipCode,
      phone: `(${zipCode.slice(0, 3)}) 555-0450`,
      website: "https://www.fns.usda.gov/wic",
      distance: 3.5,
      eligibility: ["Pregnant/postpartum women", "Infants and children under 5", "Income at or below 185% FPL"],
      hours: "Mon-Fri 8:30 AM - 4:30 PM",
      languages: ["English", "Spanish", "Vietnamese"],
      acceptsUninsured: true,
      slidingScale: false,
      freeServices: true,
      lastVerified: "2026-03-01",
      rating: 4.3,
      servicesOffered: ["Supplemental Foods", "Nutrition Counseling", "Breastfeeding Support", "Healthcare Referrals", "Farmer's Market Vouchers"],
    },
    {
      id: `fh-${zipCode}-hs-1`,
      name: `${region.cities[0]} Housing Authority — Emergency Assistance`,
      organizationName: "Local Housing Authority",
      category: "housing",
      description: "Emergency rental assistance, Section 8 voucher applications, and transitional housing for individuals and families facing homelessness or housing instability.",
      address: `${500 + zipNum} Federal Plaza`,
      city: region.cities[0]!,
      state: region.state,
      zipCode,
      phone: `(${zipCode.slice(0, 3)}) 555-0500`,
      website: "https://www.hud.gov/topics/rental_assistance",
      distance: 2.1,
      eligibility: ["Income below 50% AMI", "US citizen or eligible immigrant", "Proof of residency"],
      hours: "Mon-Fri 8:00 AM - 5:00 PM",
      languages: ["English", "Spanish"],
      acceptsUninsured: true,
      slidingScale: false,
      freeServices: true,
      lastVerified: "2026-03-10",
      rating: 3.9,
      servicesOffered: ["Emergency Rental Assistance", "Section 8 Applications", "Transitional Housing", "Utility Assistance Referrals", "Homelessness Prevention"],
    },
    {
      id: `fh-${zipCode}-tr-1`,
      name: `${region.state} Medicaid Non-Emergency Medical Transportation`,
      organizationName: "State Medicaid Agency",
      category: "transportation",
      description: "Free rides to medical appointments for Medicaid-eligible individuals. Includes non-emergency ambulance, van, public transit passes, and mileage reimbursement.",
      address: "Statewide service — call to schedule",
      city: region.cities[0]!,
      state: region.state,
      zipCode,
      phone: `(${zipCode.slice(0, 3)}) 555-0600`,
      website: "https://www.medicaid.gov/medicaid/benefits/nemt/index.html",
      distance: 0,
      eligibility: ["Active Medicaid enrollment", "Appointment must be Medicaid-covered", "Schedule 48 hours in advance"],
      hours: "24/7 scheduling hotline",
      languages: ["English", "Spanish"],
      acceptsUninsured: false,
      slidingScale: false,
      freeServices: true,
      lastVerified: "2026-01-15",
      rating: 3.8,
      servicesOffered: ["Medical Appointment Rides", "Public Transit Passes", "Mileage Reimbursement", "Wheelchair-Accessible Vehicles"],
    },
    {
      id: `fh-${zipCode}-fn-1`,
      name: `${region.cities[0]} Financial Empowerment Center`,
      organizationName: "Cities for Financial Empowerment Fund",
      category: "financial",
      description: "Free one-on-one financial counseling including debt management, credit building, banking access, and benefits screening. No income requirements.",
      address: `${700 + zipNum} Commerce Blvd`,
      city: region.cities[0]!,
      state: region.state,
      zipCode,
      phone: `(${zipCode.slice(0, 3)}) 555-0700`,
      website: "https://cfefund.org",
      distance: 1.9,
      eligibility: ["No income requirement", "Must live or work in service area", "By appointment"],
      hours: "Mon-Fri 9:00 AM - 5:00 PM, some evening hours available",
      languages: ["English", "Spanish", "Mandarin", "Haitian Creole"],
      acceptsUninsured: true,
      slidingScale: false,
      freeServices: true,
      lastVerified: "2026-03-05",
      rating: 4.6,
      servicesOffered: ["Debt Management Plans", "Credit Report Review", "Bank Account Opening", "Benefits Screening", "Tax Prep (VITA)", "Student Loan Counseling"],
    },
    {
      id: `fh-${zipCode}-lg-1`,
      name: `${region.state} Legal Aid Society`,
      organizationName: "Legal Services Corporation",
      category: "legal",
      description: "Free civil legal services for low-income individuals covering housing disputes, domestic violence protection, immigration, public benefits denials, and healthcare access.",
      address: `${800 + zipNum} Justice Way`,
      city: region.cities[1]!,
      state: region.state,
      zipCode,
      phone: `(${zipCode.slice(0, 3)}) 555-0800`,
      website: "https://www.lsc.gov/what-legal-aid/find-legal-aid",
      distance: 4.2,
      eligibility: ["Income at or below 125% FPL", "Civil matters only (no criminal)", "Residency in service area"],
      hours: "Mon-Fri 9:00 AM - 5:00 PM",
      languages: ["English", "Spanish"],
      acceptsUninsured: true,
      slidingScale: false,
      freeServices: true,
      lastVerified: "2026-02-20",
      rating: 4.4,
      servicesOffered: ["Eviction Defense", "Domestic Violence Protection", "Immigration Assistance", "Benefits Appeals", "Medical Debt Legal Help", "Disability Rights"],
    },
    {
      id: `fh-${zipCode}-mh-1`,
      name: `${region.cities[0]} Crisis Center — 988 Suicide & Crisis Lifeline`,
      organizationName: "SAMHSA / Vibrant Emotional Health",
      category: "mental-health",
      description: "24/7 crisis counseling, suicide prevention, and mental health referrals. Call or text 988. Walk-in crisis stabilization services also available.",
      address: `${900 + zipNum} Wellness Drive`,
      city: region.cities[0]!,
      state: region.state,
      zipCode,
      phone: "988 (24/7 Lifeline)",
      website: "https://988lifeline.org",
      distance: 1.5,
      eligibility: ["Anyone in crisis", "No insurance needed", "No ID required"],
      hours: "24/7 — Call or text 988",
      languages: ["English", "Spanish", "150+ languages via interpreter"],
      acceptsUninsured: true,
      slidingScale: false,
      freeServices: true,
      lastVerified: "2026-03-25",
      rating: 4.9,
      servicesOffered: ["24/7 Phone & Text Crisis Line", "Walk-in Crisis Stabilization", "Peer Support", "Follow-up Care Coordination", "Veterans Crisis Line (press 1)"],
    },
    {
      id: `fh-${zipCode}-mh-2`,
      name: `${region.cities[2]} Community Mental Health Center`,
      organizationName: "Community Behavioral Health Association",
      category: "mental-health",
      description: "Outpatient mental health services including therapy, psychiatric evaluation, medication management, and group counseling. Sliding-fee scale for uninsured patients.",
      address: `${150 + zipNum} Serenity Lane`,
      city: region.cities[2]!,
      state: region.state,
      zipCode,
      phone: `(${zipCode.slice(0, 3)}) 555-0150`,
      website: "https://www.samhsa.gov/find-treatment",
      distance: 3.7,
      eligibility: ["All ages welcome", "Sliding-fee scale", "No insurance required"],
      hours: "Mon-Fri 8:00 AM - 7:00 PM",
      languages: ["English", "Spanish"],
      acceptsUninsured: true,
      slidingScale: true,
      freeServices: false,
      lastVerified: "2026-03-18",
      rating: 4.3,
      servicesOffered: ["Individual Therapy", "Psychiatric Evaluation", "Medication Management", "Group Counseling", "Family Therapy", "Child & Adolescent Services"],
    },
    {
      id: `fh-${zipCode}-su-1`,
      name: `${region.state} Substance Abuse Treatment Locator`,
      organizationName: "SAMHSA",
      category: "substance-use",
      description: "SAMHSA-funded treatment programs offering detox, residential treatment, outpatient counseling, medication-assisted treatment (MAT), and peer recovery support at no cost.",
      address: `${250 + zipNum} Recovery Road`,
      city: region.cities[3]!,
      state: region.state,
      zipCode,
      phone: "1-800-662-4357 (SAMHSA Helpline)",
      website: "https://findtreatment.gov",
      distance: 5.1,
      eligibility: ["All individuals seeking help", "Many programs accept uninsured", "Some require referral"],
      hours: "Helpline 24/7; Centers vary",
      languages: ["English", "Spanish"],
      acceptsUninsured: true,
      slidingScale: true,
      freeServices: true,
      lastVerified: "2026-03-12",
      rating: 4.2,
      servicesOffered: ["Detoxification", "Residential Treatment", "Outpatient Counseling", "Medication-Assisted Treatment (MAT)", "Peer Recovery Support", "Naloxone Distribution"],
    },
    {
      id: `fh-${zipCode}-cc-1`,
      name: `${region.cities[0]} Head Start / Early Head Start`,
      organizationName: "Office of Head Start (HHS)",
      category: "childcare",
      description: "Comprehensive early childhood education program for children birth to 5 from low-income families. Includes education, health, nutrition, and family support services.",
      address: `${400 + zipNum} Learning Lane`,
      city: region.cities[0]!,
      state: region.state,
      zipCode,
      phone: `(${zipCode.slice(0, 3)}) 555-0400`,
      website: "https://eclkc.ohs.acf.hhs.gov/hslc/HeadStartOffices",
      distance: 2.3,
      eligibility: ["Children birth to 5", "Family income below 100% FPL", "Foster children automatically eligible", "Families receiving SNAP/TANF"],
      hours: "Mon-Fri 7:30 AM - 5:30 PM (school year)",
      languages: ["English", "Spanish"],
      acceptsUninsured: true,
      slidingScale: false,
      freeServices: true,
      lastVerified: "2026-02-15",
      rating: 4.5,
      servicesOffered: ["Preschool Education", "Health Screenings", "Nutritious Meals", "Family Support Services", "Disability Services", "Parent Education"],
    },
    {
      id: `fh-${zipCode}-ut-1`,
      name: `${region.state} LIHEAP — Low Income Home Energy Assistance`,
      organizationName: "HHS Office of Community Services",
      category: "utilities",
      description: "Federal program helping low-income households with energy costs including heating/cooling bills, energy crisis assistance, weatherization, and utility shutoff prevention.",
      address: `${550 + zipNum} Social Services Center`,
      city: region.cities[1]!,
      state: region.state,
      zipCode,
      phone: `(${zipCode.slice(0, 3)}) 555-0550`,
      website: "https://www.acf.hhs.gov/ocs/programs/liheap",
      distance: 3.0,
      eligibility: ["Income at or below 150% FPL (or 60% state median)", "Must pay own heating/cooling", "Proof of residency"],
      hours: "Mon-Fri 8:00 AM - 4:30 PM",
      languages: ["English", "Spanish"],
      acceptsUninsured: true,
      slidingScale: false,
      freeServices: true,
      lastVerified: "2026-01-20",
      rating: 4.0,
      servicesOffered: ["Heating Bill Assistance", "Cooling Bill Assistance", "Energy Crisis Intervention", "Weatherization Referrals", "Utility Shutoff Prevention"],
    },
    {
      id: `fh-${zipCode}-em-1`,
      name: `${region.cities[0]} American Job Center (CareerOneStop)`,
      organizationName: "U.S. Department of Labor",
      category: "employment",
      description: "Free career services including job search assistance, resume help, skills training, GED programs, and connections to apprenticeships and workforce development.",
      address: `${650 + zipNum} Workforce Way`,
      city: region.cities[0]!,
      state: region.state,
      zipCode,
      phone: `(${zipCode.slice(0, 3)}) 555-0650`,
      website: "https://www.careeronestop.org",
      distance: 2.5,
      eligibility: ["Open to all job seekers", "Veterans receive priority", "Youth programs ages 16-24"],
      hours: "Mon-Fri 8:30 AM - 4:30 PM",
      languages: ["English", "Spanish"],
      acceptsUninsured: true,
      slidingScale: false,
      freeServices: true,
      lastVerified: "2026-03-08",
      rating: 4.1,
      servicesOffered: ["Job Search Assistance", "Resume & Interview Prep", "Skills Training", "GED Programs", "Apprenticeship Connections", "Veterans Employment Services"],
    },
    {
      id: `fh-${zipCode}-ed-1`,
      name: `${region.cities[2]} Public Library — Digital Literacy & Health Info`,
      organizationName: "American Library Association",
      category: "education",
      description: "Free health literacy resources, computer access, internet for telehealth appointments, health insurance enrollment assistance, and community health programs.",
      address: `${750 + zipNum} Library Square`,
      city: region.cities[2]!,
      state: region.state,
      zipCode,
      phone: `(${zipCode.slice(0, 3)}) 555-0750`,
      website: "https://www.ala.org",
      distance: 1.0,
      eligibility: ["Open to all community members", "Library card is free", "No ID needed for basic services"],
      hours: "Mon-Sat 9:00 AM - 8:00 PM, Sun 1:00 PM - 5:00 PM",
      languages: ["English", "Spanish", "Multiple via resources"],
      acceptsUninsured: true,
      slidingScale: false,
      freeServices: true,
      lastVerified: "2026-03-20",
      rating: 4.7,
      servicesOffered: ["Free Computer & Internet Access", "Health Insurance Enrollment Help", "Health Literacy Programs", "Telehealth-Friendly Private Rooms", "ESL Classes", "Tax Preparation (VITA)"],
    },
  ];

  let filtered = allResources;
  if (category) {
    filtered = allResources.filter(r => r.category === category);
  }

  filtered = filtered.filter(r => r.distance <= radius);
  filtered.sort((a, b) => a.distance - b.distance);

  return filtered;
}

router.get("/search", (req, res) => {
  try {
    const zipCode = (req.query.zipCode as string) || "10001";
    const category = (req.query.category as SDoHCategory | undefined) || null;
    const radius = parseInt(req.query.radius as string) || 10;

    if (!/^\d{5}$/.test(zipCode)) {
      return res.status(400).json({ error: "Invalid ZIP code. Must be 5 digits." });
    }

    const resources = generateResourcesForZip(zipCode, category, Math.min(radius, 50));

    const categoryCounts = Object.keys(CATEGORY_LABELS).map(cat => {
      const allForCat = generateResourcesForZip(zipCode, cat as SDoHCategory, Math.min(radius, 50));
      return {
        category: cat as SDoHCategory,
        count: allForCat.length,
        label: CATEGORY_LABELS[cat as SDoHCategory],
      };
    }).filter(c => c.count > 0);

    const result: FindHelpSearchResult = {
      query: { zipCode, category, radius: Math.min(radius, 50) },
      totalResults: resources.length,
      resources,
      categories: categoryCounts,
      lastUpdated: new Date().toISOString(),
    };

    res.json(result);
  } catch (error) {
    console.error("[FindHelp] Search error:", error);
    res.status(500).json({ error: "Failed to search resources" });
  }
});

router.get("/categories", (_req, res) => {
  const categories = Object.entries(CATEGORY_LABELS).map(([key, label]) => ({
    id: key,
    label,
    icon: getCategoryIcon(key as SDoHCategory),
  }));
  res.json({ categories });
});

router.get("/resource/:id", (req, res) => {
  const { id } = req.params;
  const parts = id.split("-");
  if (parts.length < 3) {
    return res.status(400).json({ error: "Invalid resource ID" });
  }
  const zipCode = parts[1]!;
  const allResources = generateResourcesForZip(zipCode, null, 50);
  const resource = allResources.find(r => r.id === id);
  if (!resource) {
    return res.status(404).json({ error: "Resource not found" });
  }
  res.json(resource);
});

router.get("/screening", (_req, res) => {
  const questions = [
    { id: "food", question: "In the last 12 months, did you worry about running out of food before you had money to buy more?", category: "food" as SDoHCategory },
    { id: "housing", question: "Are you worried about losing your housing?", category: "housing" as SDoHCategory },
    { id: "utilities", question: "In the last 12 months, has your utility company threatened to shut off services?", category: "utilities" as SDoHCategory },
    { id: "transportation", question: "Do you have trouble getting transportation to medical appointments?", category: "transportation" as SDoHCategory },
    { id: "safety", question: "Do you feel physically or emotionally unsafe where you currently live?", category: "housing" as SDoHCategory },
    { id: "financial", question: "Are you having trouble paying for medications or medical bills?", category: "financial" as SDoHCategory },
    { id: "childcare", question: "Do you need help finding childcare or after-school programs?", category: "childcare" as SDoHCategory },
    { id: "employment", question: "Are you unemployed or looking for job training?", category: "employment" as SDoHCategory },
    { id: "mental-health", question: "In the last 2 weeks, have you felt down, depressed, or hopeless?", category: "mental-health" as SDoHCategory },
    { id: "substance", question: "Do you or a family member need help with substance use?", category: "substance-use" as SDoHCategory },
  ];
  res.json({ questions, source: "Adapted from CMS Accountable Health Communities (AHC) Health-Related Social Needs (HRSN) Screening Tool" });
});

router.post("/screening/results", (req, res) => {
  try {
    const { answers, zipCode } = req.body;
    if (!answers || !zipCode) {
      return res.status(400).json({ error: "Answers and ZIP code are required" });
    }

    const positiveCategories: SDoHCategory[] = [];
    if (Array.isArray(answers)) {
      for (const answer of answers) {
        if (answer.positive && answer.category) {
          if (!positiveCategories.includes(answer.category)) {
            positiveCategories.push(answer.category);
          }
        }
      }
    }

    const recommendations: { category: SDoHCategory; label: string; resources: SDoHResource[]; urgency: "high" | "medium" | "low" }[] = [];

    const highUrgency: SDoHCategory[] = ["healthcare", "food", "housing", "mental-health"];

    for (const cat of positiveCategories) {
      const resources = generateResourcesForZip(zipCode, cat, 15);
      recommendations.push({
        category: cat,
        label: CATEGORY_LABELS[cat] || cat,
        resources: resources.slice(0, 3),
        urgency: highUrgency.includes(cat) ? "high" : "medium",
      });
    }

    recommendations.sort((a, b) => {
      const urgencyOrder = { high: 0, medium: 1, low: 2 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });

    res.json({
      totalNeeds: positiveCategories.length,
      recommendations,
      screeningDate: new Date().toISOString(),
      followUpRecommended: positiveCategories.length >= 3,
      crisisResources: positiveCategories.includes("mental-health") ? {
        lifeline: "988 Suicide & Crisis Lifeline — Call or text 988",
        crisisText: "Text HOME to 741741 (Crisis Text Line)",
        veteransCrisis: "988 then press 1 (Veterans Crisis Line)",
      } : null,
    });
  } catch (error) {
    console.error("[FindHelp] Screening error:", error);
    res.status(500).json({ error: "Failed to process screening" });
  }
});

function getCategoryIcon(category: SDoHCategory): string {
  const icons: Record<SDoHCategory, string> = {
    healthcare: "stethoscope",
    food: "utensils",
    housing: "home",
    transportation: "car",
    financial: "dollar-sign",
    legal: "scale",
    education: "book-open",
    employment: "briefcase",
    "mental-health": "brain",
    "substance-use": "heart-pulse",
    childcare: "baby",
    utilities: "zap",
  };
  return icons[category] || "circle";
}

export default router;
