import { Router } from "express";

const router = Router();

interface SesameProvider {
  id: string;
  name: string;
  credentials: string;
  specialty: string;
  rating: number;
  reviewCount: number;
  photo: string;
  bio: string;
  languages: string[];
  acceptsNewPatients: boolean;
  nextAvailable: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  distance: number;
  virtualAvailable: boolean;
  inPersonAvailable: boolean;
}

interface SesameService {
  id: string;
  name: string;
  category: string;
  description: string;
  sesamePrice: number;
  typicalInsuredPrice: number;
  typicalUninsuredPrice: number;
  duration: string;
  includedItems: string[];
}

interface SesameAppointmentSlot {
  id: string;
  providerId: string;
  date: string;
  time: string;
  type: "virtual" | "in-person";
  available: boolean;
}

const SERVICE_CATEGORIES = [
  "Primary Care",
  "Urgent Care",
  "Mental Health",
  "Dermatology",
  "Women's Health",
  "Pediatrics",
  "Lab Work",
  "Imaging",
  "Dental",
  "Vision",
  "Specialist Consult",
  "Preventive Care",
];

function generateServices(): SesameService[] {
  return [
    { id: "svc-pcp-new", name: "New Patient Visit (Primary Care)", category: "Primary Care", description: "Comprehensive initial visit with a primary care physician. Includes medical history review, physical exam, health assessment, and treatment plan.", sesamePrice: 75, typicalInsuredPrice: 150, typicalUninsuredPrice: 250, duration: "45 min", includedItems: ["Physical exam", "Health assessment", "Treatment plan", "Prescription (if needed)", "Follow-up plan"] },
    { id: "svc-pcp-follow", name: "Follow-Up Visit (Primary Care)", category: "Primary Care", description: "Return visit to review test results, adjust medications, or continue treatment for an existing condition.", sesamePrice: 50, typicalInsuredPrice: 120, typicalUninsuredPrice: 200, duration: "20 min", includedItems: ["Symptom review", "Medication adjustment", "Treatment plan update"] },
    { id: "svc-urgent", name: "Urgent Care Visit", category: "Urgent Care", description: "Same-day care for non-emergency issues like infections, minor injuries, cold/flu, UTIs, and rashes.", sesamePrice: 85, typicalInsuredPrice: 175, typicalUninsuredPrice: 300, duration: "30 min", includedItems: ["Exam & diagnosis", "Basic labs (if needed)", "Prescription (if needed)", "Work/school note"] },
    { id: "svc-telehealth", name: "Telehealth Visit (General)", category: "Primary Care", description: "Video or phone consultation for non-emergency concerns. Convenient care from home for common conditions.", sesamePrice: 35, typicalInsuredPrice: 100, typicalUninsuredPrice: 150, duration: "15 min", includedItems: ["Video consultation", "E-prescription", "Follow-up message"] },
    { id: "svc-mental-initial", name: "Mental Health – Initial Assessment", category: "Mental Health", description: "Comprehensive psychiatric or psychological evaluation for anxiety, depression, ADHD, PTSD, or other mental health concerns.", sesamePrice: 125, typicalInsuredPrice: 250, typicalUninsuredPrice: 400, duration: "60 min", includedItems: ["Psychiatric evaluation", "Diagnosis", "Treatment plan", "Medication evaluation"] },
    { id: "svc-mental-therapy", name: "Therapy Session (50 min)", category: "Mental Health", description: "Individual therapy session with a licensed therapist. CBT, DBT, EMDR, and other evidence-based approaches.", sesamePrice: 80, typicalInsuredPrice: 180, typicalUninsuredPrice: 250, duration: "50 min", includedItems: ["Individual therapy", "Treatment progress review", "Homework/exercises"] },
    { id: "svc-mental-med", name: "Medication Management (Psychiatry)", category: "Mental Health", description: "Follow-up visit with a psychiatrist or psychiatric NP to review and adjust psychiatric medications.", sesamePrice: 95, typicalInsuredPrice: 200, typicalUninsuredPrice: 350, duration: "20 min", includedItems: ["Medication review", "Dose adjustment", "Refill prescriptions", "Side-effect monitoring"] },
    { id: "svc-derm", name: "Dermatology Visit", category: "Dermatology", description: "Evaluation and treatment for skin conditions including acne, eczema, psoriasis, rashes, moles, and skin cancer screening.", sesamePrice: 95, typicalInsuredPrice: 200, typicalUninsuredPrice: 350, duration: "20 min", includedItems: ["Skin exam", "Diagnosis", "Treatment plan", "Prescription (if needed)"] },
    { id: "svc-women-annual", name: "Women's Wellness Exam", category: "Women's Health", description: "Annual well-woman visit including pelvic exam, breast exam, Pap smear, and preventive health counseling.", sesamePrice: 99, typicalInsuredPrice: 225, typicalUninsuredPrice: 400, duration: "30 min", includedItems: ["Pelvic exam", "Breast exam", "Pap smear", "Contraception counseling", "STI screening (add-on)"] },
    { id: "svc-peds", name: "Pediatric Well-Child Visit", category: "Pediatrics", description: "Comprehensive wellness check for children including growth assessment, developmental screening, and immunization review.", sesamePrice: 65, typicalInsuredPrice: 150, typicalUninsuredPrice: 225, duration: "30 min", includedItems: ["Growth assessment", "Developmental screening", "Vision/hearing check", "Immunization review", "Parenting guidance"] },
    { id: "svc-lab-basic", name: "Basic Lab Panel (CBC + CMP)", category: "Lab Work", description: "Complete blood count and comprehensive metabolic panel. Common screening for overall health, organ function, and blood disorders.", sesamePrice: 25, typicalInsuredPrice: 80, typicalUninsuredPrice: 200, duration: "15 min", includedItems: ["CBC (Complete Blood Count)", "CMP (Comprehensive Metabolic Panel)", "Digital results in 24-48 hours"] },
    { id: "svc-lab-lipid", name: "Lipid Panel + A1C", category: "Lab Work", description: "Cholesterol and diabetes screening. Includes total cholesterol, HDL, LDL, triglycerides, and hemoglobin A1C.", sesamePrice: 30, typicalInsuredPrice: 100, typicalUninsuredPrice: 250, duration: "15 min", includedItems: ["Lipid panel", "Hemoglobin A1C", "Risk assessment", "Digital results"] },
    { id: "svc-lab-thyroid", name: "Thyroid Panel (TSH + Free T4)", category: "Lab Work", description: "Thyroid function screening. Checks for hypothyroidism, hyperthyroidism, and thyroid disorders.", sesamePrice: 20, typicalInsuredPrice: 75, typicalUninsuredPrice: 150, duration: "10 min", includedItems: ["TSH", "Free T4", "Digital results in 24-48 hours"] },
    { id: "svc-lab-std", name: "Full STI Panel", category: "Lab Work", description: "Comprehensive sexually transmitted infection screening including HIV, syphilis, gonorrhea, chlamydia, hepatitis B & C, and herpes.", sesamePrice: 99, typicalInsuredPrice: 300, typicalUninsuredPrice: 600, duration: "15 min", includedItems: ["HIV 1/2", "Syphilis", "Gonorrhea/Chlamydia", "Hepatitis B & C", "HSV-1/2", "Confidential results"] },
    { id: "svc-vision", name: "Vision Exam (Comprehensive)", category: "Vision", description: "Complete eye exam including refraction, glaucoma screening, retinal exam, and contact lens evaluation.", sesamePrice: 60, typicalInsuredPrice: 150, typicalUninsuredPrice: 250, duration: "30 min", includedItems: ["Visual acuity", "Refraction", "Glaucoma screening", "Retinal exam", "Contact lens eval (add-on)"] },
    { id: "svc-dental-clean", name: "Dental Cleaning & Exam", category: "Dental", description: "Professional dental cleaning, oral exam, and X-rays. Includes fluoride treatment.", sesamePrice: 79, typicalInsuredPrice: 200, typicalUninsuredPrice: 350, duration: "60 min", includedItems: ["Professional cleaning", "Oral exam", "X-rays (bitewing)", "Fluoride treatment", "Treatment plan"] },
    { id: "svc-preventive", name: "Annual Physical / Wellness Exam", category: "Preventive Care", description: "Comprehensive annual physical including vital signs, physical exam, screenings discussion, and preventive care plan.", sesamePrice: 99, typicalInsuredPrice: 250, typicalUninsuredPrice: 400, duration: "45 min", includedItems: ["Complete physical exam", "Vitals & BMI", "Screening recommendations", "Preventive care plan", "Basic lab order"] },
    { id: "svc-specialist", name: "Specialist Consultation", category: "Specialist Consult", description: "Initial consultation with a specialist (cardiology, gastroenterology, orthopedics, ENT, etc.) for evaluation and treatment recommendations.", sesamePrice: 125, typicalInsuredPrice: 300, typicalUninsuredPrice: 500, duration: "30 min", includedItems: ["Specialist evaluation", "Diagnosis", "Treatment recommendations", "Referral coordination"] },
  ];
}

function generateProviders(zipCode: string): SesameProvider[] {
  const zipNum = parseInt(zipCode.slice(0, 3)) || 100;
  const stateMap: Record<number, { state: string; stateAbbr: string; cities: string[] }> = {
    1: { state: "New York", stateAbbr: "NY", cities: ["New York", "Brooklyn", "Queens", "Bronx"] },
    2: { state: "Virginia", stateAbbr: "VA", cities: ["Arlington", "Alexandria", "Richmond", "Norfolk"] },
    3: { state: "Florida", stateAbbr: "FL", cities: ["Miami", "Orlando", "Tampa", "Jacksonville"] },
    4: { state: "Georgia", stateAbbr: "GA", cities: ["Atlanta", "Savannah", "Augusta", "Decatur"] },
    5: { state: "Texas", stateAbbr: "TX", cities: ["Houston", "Dallas", "Austin", "San Antonio"] },
    6: { state: "Illinois", stateAbbr: "IL", cities: ["Chicago", "Naperville", "Evanston", "Oak Park"] },
    7: { state: "Oklahoma", stateAbbr: "OK", cities: ["Oklahoma City", "Tulsa", "Norman", "Edmond"] },
    8: { state: "Colorado", stateAbbr: "CO", cities: ["Denver", "Boulder", "Aurora", "Lakewood"] },
    9: { state: "California", stateAbbr: "CA", cities: ["Los Angeles", "San Francisco", "San Diego", "Pasadena"] },
    0: { state: "Massachusetts", stateAbbr: "MA", cities: ["Boston", "Cambridge", "Somerville", "Brookline"] },
  };
  const region = stateMap[zipNum % 10] || stateMap[1]!;

  const providers: SesameProvider[] = [
    {
      id: `ses-${zipCode}-001`,
      name: "Dr. Sarah Chen",
      credentials: "MD, Board Certified Internal Medicine",
      specialty: "Primary Care",
      rating: 4.9,
      reviewCount: 342,
      photo: "",
      bio: "Dr. Chen is a board-certified internist with 12 years of experience in direct primary care. She believes in transparent pricing and spending quality time with each patient. Special interests include preventive medicine and chronic disease management.",
      languages: ["English", "Mandarin"],
      acceptsNewPatients: true,
      nextAvailable: getNextAvailableDate(1),
      address: `${100 + zipNum} Medical Plaza, Suite 200`,
      city: region.cities[0]!,
      state: region.stateAbbr,
      zipCode,
      distance: 1.3,
      virtualAvailable: true,
      inPersonAvailable: true,
    },
    {
      id: `ses-${zipCode}-002`,
      name: "Dr. Marcus Johnson",
      credentials: "DO, Family Medicine",
      specialty: "Primary Care",
      rating: 4.8,
      reviewCount: 218,
      photo: "",
      bio: "Dr. Johnson is a family medicine physician who provides comprehensive care for patients of all ages. He's passionate about making healthcare affordable and accessible without the complexity of insurance billing.",
      languages: ["English", "Spanish"],
      acceptsNewPatients: true,
      nextAvailable: getNextAvailableDate(0),
      address: `${200 + zipNum} Wellness Drive`,
      city: region.cities[1]!,
      state: region.stateAbbr,
      zipCode,
      distance: 2.7,
      virtualAvailable: true,
      inPersonAvailable: true,
    },
    {
      id: `ses-${zipCode}-003`,
      name: "Dr. Priya Patel",
      credentials: "MD, Board Certified Psychiatry",
      specialty: "Mental Health",
      rating: 4.9,
      reviewCount: 187,
      photo: "",
      bio: "Dr. Patel is a board-certified psychiatrist specializing in anxiety, depression, ADHD, and PTSD. She offers both medication management and integrative approaches to mental health care.",
      languages: ["English", "Hindi", "Gujarati"],
      acceptsNewPatients: true,
      nextAvailable: getNextAvailableDate(2),
      address: `${300 + zipNum} Behavioral Health Center`,
      city: region.cities[0]!,
      state: region.stateAbbr,
      zipCode,
      distance: 3.1,
      virtualAvailable: true,
      inPersonAvailable: true,
    },
    {
      id: `ses-${zipCode}-004`,
      name: "Emily Rodriguez, LCSW",
      credentials: "Licensed Clinical Social Worker",
      specialty: "Mental Health",
      rating: 4.7,
      reviewCount: 156,
      photo: "",
      bio: "Emily is a licensed therapist with 8 years of experience in CBT, DBT, and trauma-focused therapy. She specializes in helping adults navigate anxiety, relationship issues, and life transitions.",
      languages: ["English", "Spanish"],
      acceptsNewPatients: true,
      nextAvailable: getNextAvailableDate(0),
      address: `${400 + zipNum} Counseling Suite`,
      city: region.cities[2]!,
      state: region.stateAbbr,
      zipCode,
      distance: 1.8,
      virtualAvailable: true,
      inPersonAvailable: false,
    },
    {
      id: `ses-${zipCode}-005`,
      name: "Dr. James O'Brien",
      credentials: "MD, Dermatology",
      specialty: "Dermatology",
      rating: 4.6,
      reviewCount: 129,
      photo: "",
      bio: "Dr. O'Brien is a board-certified dermatologist offering direct-pay skin care. He sees patients for acne, eczema, psoriasis, skin cancer screening, and cosmetic consultations.",
      languages: ["English"],
      acceptsNewPatients: true,
      nextAvailable: getNextAvailableDate(3),
      address: `${500 + zipNum} Dermatology Center`,
      city: region.cities[0]!,
      state: region.stateAbbr,
      zipCode,
      distance: 4.2,
      virtualAvailable: true,
      inPersonAvailable: true,
    },
    {
      id: `ses-${zipCode}-006`,
      name: "Dr. Aisha Williams",
      credentials: "MD, OB/GYN",
      specialty: "Women's Health",
      rating: 4.8,
      reviewCount: 203,
      photo: "",
      bio: "Dr. Williams provides comprehensive women's health care including annual exams, contraception counseling, prenatal care, and menopause management at transparent, upfront prices.",
      languages: ["English", "French"],
      acceptsNewPatients: true,
      nextAvailable: getNextAvailableDate(1),
      address: `${600 + zipNum} Women's Health Pavilion`,
      city: region.cities[1]!,
      state: region.stateAbbr,
      zipCode,
      distance: 2.1,
      virtualAvailable: true,
      inPersonAvailable: true,
    },
    {
      id: `ses-${zipCode}-007`,
      name: "Dr. David Kim",
      credentials: "MD, Pediatrics",
      specialty: "Pediatrics",
      rating: 4.9,
      reviewCount: 276,
      photo: "",
      bio: "Dr. Kim is a board-certified pediatrician who offers affordable, no-surprise-billing care for children from birth through age 18. Same-day sick visits available.",
      languages: ["English", "Korean"],
      acceptsNewPatients: true,
      nextAvailable: getNextAvailableDate(0),
      address: `${700 + zipNum} Children's Clinic`,
      city: region.cities[3]!,
      state: region.stateAbbr,
      zipCode,
      distance: 3.5,
      virtualAvailable: true,
      inPersonAvailable: true,
    },
    {
      id: `ses-${zipCode}-008`,
      name: "Michael Torres, NP",
      credentials: "Nurse Practitioner, Family Medicine",
      specialty: "Urgent Care",
      rating: 4.7,
      reviewCount: 164,
      photo: "",
      bio: "Michael is a board-certified family nurse practitioner providing urgent care and primary care services. He specializes in treating acute illnesses, minor injuries, and chronic conditions at fair, transparent prices.",
      languages: ["English", "Spanish", "Portuguese"],
      acceptsNewPatients: true,
      nextAvailable: getNextAvailableDate(0),
      address: `${800 + zipNum} Urgent Care Center`,
      city: region.cities[0]!,
      state: region.stateAbbr,
      zipCode,
      distance: 0.9,
      virtualAvailable: true,
      inPersonAvailable: true,
    },
  ];

  return providers.sort((a, b) => a.distance - b.distance);
}

function getNextAvailableDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  return d.toISOString().split("T")[0]!;
}

function generateSlots(providerId: string): SesameAppointmentSlot[] {
  const slots: SesameAppointmentSlot[] = [];
  const times = ["9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM"];

  for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const dateStr = d.toISOString().split("T")[0]!;

    for (const time of times) {
      const hash = (providerId.charCodeAt(providerId.length - 1) + dayOffset * 7 + times.indexOf(time) * 3) % 10;
      slots.push({
        id: `slot-${providerId}-${dateStr}-${time.replace(/[\s:]/g, "")}`,
        providerId,
        date: dateStr,
        time,
        type: hash > 3 ? "in-person" : "virtual",
        available: hash !== 5 && hash !== 8,
      });
    }
  }

  return slots;
}

router.get("/services", (req, res) => {
  try {
    const category = req.query.category as string | undefined;
    let services = generateServices();
    if (category && category !== "all") {
      services = services.filter(s => s.category === category);
    }
    const categories = SERVICE_CATEGORIES.map(cat => ({
      name: cat,
      count: generateServices().filter(s => s.category === cat).length,
    })).filter(c => c.count > 0);

    res.json({ services, categories, totalServices: services.length });
  } catch (error) {
    console.error("[SesameCare] Services error:", error);
    res.status(500).json({ error: "Failed to fetch services" });
  }
});

router.get("/providers", (req, res) => {
  try {
    const zipCode = (req.query.zipCode as string) || "10001";
    const specialty = req.query.specialty as string | undefined;

    if (!/^\d{5}$/.test(zipCode)) {
      return res.status(400).json({ error: "Invalid ZIP code" });
    }

    let providers = generateProviders(zipCode);
    if (specialty && specialty !== "all") {
      providers = providers.filter(p => p.specialty === specialty);
    }

    res.json({
      providers,
      totalProviders: providers.length,
      query: { zipCode, specialty: specialty || "all" },
    });
  } catch (error) {
    console.error("[SesameCare] Providers error:", error);
    res.status(500).json({ error: "Failed to fetch providers" });
  }
});

router.get("/providers/:id/slots", (req, res) => {
  try {
    const { id } = req.params;
    const slots = generateSlots(id);
    const availableSlots = slots.filter(s => s.available);

    const dateGroups: Record<string, SesameAppointmentSlot[]> = {};
    for (const slot of availableSlots) {
      if (!dateGroups[slot.date]) dateGroups[slot.date] = [];
      dateGroups[slot.date]!.push(slot);
    }

    res.json({
      providerId: id,
      totalSlots: availableSlots.length,
      dateGroups,
    });
  } catch (error) {
    console.error("[SesameCare] Slots error:", error);
    res.status(500).json({ error: "Failed to fetch appointment slots" });
  }
});

router.post("/book", (req, res) => {
  try {
    const { providerId, serviceId, slotId, patientName, patientEmail, patientPhone, visitType } = req.body;

    if (!providerId || !serviceId || !slotId) {
      return res.status(400).json({ error: "Provider, service, and slot are required" });
    }

    const services = generateServices();
    const service = services.find(s => s.id === serviceId);
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    const confirmationNumber = `SES-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    res.json({
      success: true,
      booking: {
        confirmationNumber,
        providerId,
        serviceId,
        serviceName: service.name,
        slotId,
        visitType: visitType || "in-person",
        price: service.sesamePrice,
        patientName: patientName || "Patient",
        status: "confirmed",
        paymentDueAtVisit: true,
        cancellationPolicy: "Free cancellation up to 4 hours before appointment",
        createdAt: new Date().toISOString(),
      },
      message: `Appointment confirmed! Your ${service.name} visit has been booked. Confirmation #${confirmationNumber}. Payment of $${service.sesamePrice} is due at the time of your visit. No surprise bills — this is the total price.`,
    });
  } catch (error) {
    console.error("[SesameCare] Booking error:", error);
    res.status(500).json({ error: "Failed to book appointment" });
  }
});

router.get("/price-compare/:serviceId", (req, res) => {
  try {
    const { serviceId } = req.params;
    const services = generateServices();
    const service = services.find(s => s.id === serviceId);

    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    const sesameSavingsVsUninsured = Math.round(((service.typicalUninsuredPrice - service.sesamePrice) / service.typicalUninsuredPrice) * 100);
    const sesameSavingsVsInsured = Math.round(((service.typicalInsuredPrice - service.sesamePrice) / service.typicalInsuredPrice) * 100);

    res.json({
      service: service.name,
      comparison: {
        sesamePrice: service.sesamePrice,
        typicalInsuredPrice: service.typicalInsuredPrice,
        typicalUninsuredPrice: service.typicalUninsuredPrice,
        savingsVsUninsured: `${sesameSavingsVsUninsured}%`,
        savingsVsInsured: `${sesameSavingsVsInsured}%`,
        dollarSavedVsUninsured: service.typicalUninsuredPrice - service.sesamePrice,
        dollarSavedVsInsured: service.typicalInsuredPrice - service.sesamePrice,
      },
      noBills: true,
      noInsuranceNeeded: true,
      transparentPricing: true,
    });
  } catch (error) {
    console.error("[SesameCare] Price compare error:", error);
    res.status(500).json({ error: "Failed to compare prices" });
  }
});

router.get("/dpc-plans", (_req, res) => {
  const plans = [
    {
      id: "dpc-individual",
      name: "Individual Membership",
      monthlyPrice: 89,
      annualPrice: 950,
      description: "Unlimited primary care visits, telehealth, basic labs, and chronic disease management for one adult.",
      features: [
        "Unlimited office visits",
        "Same-day / next-day appointments",
        "24/7 telehealth access",
        "Basic lab work included (CBC, CMP, lipids, A1C, UA, thyroid)",
        "Chronic disease management",
        "Annual wellness exam",
        "EKG included",
        "No copays or surprise bills",
        "Direct cell/text access to your doctor",
        "Wholesale medication pricing",
      ],
      bestFor: "Individuals seeking affordable, unlimited primary care",
      savings: "Save $2,000–$4,000/year vs. traditional insurance premiums + copays",
    },
    {
      id: "dpc-couple",
      name: "Couple Membership",
      monthlyPrice: 159,
      annualPrice: 1700,
      description: "All Individual features for two adults in the same household.",
      features: [
        "Everything in Individual — for 2 adults",
        "Shared family health dashboard",
        "Coordinated care planning",
        "Couples health counseling",
      ],
      bestFor: "Couples or partners living together",
      savings: "Save $4,000–$7,000/year vs. traditional insurance for two",
    },
    {
      id: "dpc-family",
      name: "Family Membership",
      monthlyPrice: 225,
      annualPrice: 2400,
      description: "Comprehensive primary care for the whole family — 2 adults + children under 18.",
      features: [
        "Everything in Individual — for the whole family",
        "Well-child visits & immunizations",
        "School/sports physicals",
        "Pediatric sick visits",
        "Adolescent health",
        "Family health dashboard",
      ],
      bestFor: "Families with children",
      savings: "Save $6,000–$10,000/year vs. family insurance premiums",
    },
  ];

  res.json({
    plans,
    whatIsDPC: {
      title: "What is Direct Primary Care (DPC)?",
      description: "DPC is a healthcare model where patients pay their doctor directly through an affordable monthly membership — cutting out insurance middlemen. You get unlimited visits, longer appointments, and direct access to your doctor via call, text, or video. No copays, no deductibles, no surprise bills.",
      benefits: [
        "Spend 30-60 minutes with your doctor (vs. 7 min average)",
        "Same-day or next-day appointments",
        "Direct cell phone / text access to your physician",
        "No insurance billing = lower costs for you",
        "Average DPC patient saves $2,000–$6,000/year",
        "Works great paired with a catastrophic/major medical plan",
        "Over 1,800 DPC practices across all 50 states",
      ],
      stats: {
        practicesNationwide: 1800,
        averageMonthlyCost: 89,
        averageVisitLength: "30-45 min",
        patientSatisfaction: "95%+",
      },
    },
  });
});

export default router;
