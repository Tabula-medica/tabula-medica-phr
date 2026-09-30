import { Router } from "express";
import {
  medicareRates2026,
  imagingServices,
  communityResources,
  discountProviders,
} from "../services/care-access-catalog";

const router = Router();

router.get("/medicare-rates", (_req, res) => {
  res.json({ rates: medicareRates2026, categories: Array.from(new Set(medicareRates2026.map(r => r.category))), year: 2026 });
});

router.get("/medicare-rates/search", (req, res) => {
  const query = (req.query.q as string || "").toLowerCase();
  const category = req.query.category as string || "";

  let filtered = medicareRates2026;
  if (query) {
    filtered = filtered.filter(r =>
      r.cptCode.toLowerCase().includes(query) ||
      r.description.toLowerCase().includes(query)
    );
  }
  if (category) {
    filtered = filtered.filter(r => r.category === category);
  }

  res.json({ rates: filtered, total: filtered.length });
});

router.get("/imaging-services", (_req, res) => {
  res.json({ services: imagingServices });
});

router.get("/community-resources", (_req, res) => {
  res.json({ resources: communityResources, categories: Array.from(new Set(communityResources.map(r => r.category))) });
});

router.get("/discount-providers", (req, res) => {
  const state = (req.query.state as string || "").toUpperCase();
  const type = req.query.type as string || "";
  const specialty = (req.query.specialty as string || "").toLowerCase();

  let filtered = discountProviders;
  if (state) {
    filtered = filtered.filter(p => p.state === state);
  }
  if (type) {
    filtered = filtered.filter(p => p.type === type);
  }
  if (specialty) {
    filtered = filtered.filter(p => p.specialties.some(s => s.toLowerCase().includes(specialty)));
  }

  const providerTypes = Array.from(new Set(discountProviders.map(p => p.type)));
  const states = Array.from(new Set(discountProviders.map(p => p.state))).sort();

  res.json({ providers: filtered, providerTypes, states });
});

router.post("/patient-signup", (req, res) => {
  const { firstName, lastName, email, phone, zipCode } = req.body;
  if (!firstName || !lastName || !email) {
    return res.status(400).json({ error: "First name, last name, and email are required." });
  }

  res.json({
    success: true,
    memberId: `TM-${Date.now().toString(36).toUpperCase()}`,
    message: "Welcome to the Tabula Medica Discount Platform! Your membership card will be available in your account within 24 hours.",
    benefits: [
      "Access to Medicare-rate pricing at participating providers",
      "No premiums or monthly fees",
      "No deductibles — pay the listed rate at time of service",
      "Searchable provider directory with transparent pricing",
      "Digital membership card accepted at all participating providers",
    ],
  });
});

router.post("/provider-enrollment", (req, res) => {
  const { providerName, npi, specialty, email, phone, address, state } = req.body;
  if (!providerName || !npi || !email) {
    return res.status(400).json({ error: "Provider name, NPI, and email are required." });
  }

  res.json({
    success: true,
    enrollmentId: `PE-${Date.now().toString(36).toUpperCase()}`,
    message: "Thank you for joining the Tabula Medica Provider Network. Our team will review your application and contact you within 3-5 business days.",
    nextSteps: [
      "Application review by our provider relations team",
      "Credential verification via NPI registry",
      "Rate schedule confirmation based on 2026 CMS Medicare Fee Schedule",
      "Digital agreement and onboarding",
      "Listing in our patient-facing provider directory",
    ],
  });
});

router.get("/rate-calculator", (req, res) => {
  const cptCodes = (req.query.codes as string || "").split(",").filter(Boolean);
  if (cptCodes.length === 0) {
    return res.json({ items: [], totalMedicare: 0, totalUninsured: 0, totalSavings: 0 });
  }

  const items = cptCodes.map(code => {
    const rate = medicareRates2026.find(r => r.cptCode === code.trim());
    if (!rate) return null;
    return {
      ...rate,
      savingsAmount: rate.typicalUninsuredRate - rate.medicareRate,
    };
  }).filter(Boolean);

  const totalMedicare = items.reduce((sum, item) => sum + (item?.medicareRate || 0), 0);
  const totalUninsured = items.reduce((sum, item) => sum + (item?.typicalUninsuredRate || 0), 0);

  res.json({
    items,
    totalMedicare,
    totalUninsured,
    totalSavings: totalUninsured - totalMedicare,
    savingsPercent: totalUninsured > 0 ? Math.round(((totalUninsured - totalMedicare) / totalUninsured) * 100) : 0,
  });
});

export default router;
