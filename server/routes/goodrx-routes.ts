import { Router } from "express";

const router = Router();

interface GoodRxPrice {
  pharmacyName: string;
  pharmacyType: "retail" | "mail_order" | "online";
  price: number;
  priceWithCoupon: number | null;
  couponCode: string | null;
  distance: string | null;
  savings: string;
  url: string;
}

interface DrugPriceResult {
  drugName: string;
  genericName: string | null;
  form: string;
  dosage: string;
  quantity: number;
  prices: GoodRxPrice[];
  averageRetailPrice: number;
  lowestPrice: number;
  bestSavings: string;
  lastUpdated: string;
}

const drugDatabase: Record<string, { genericName: string | null; forms: string[]; dosages: string[]; avgRetailPrice: number; category: string }> = {
  "atorvastatin": { genericName: null, forms: ["tablet"], dosages: ["10mg", "20mg", "40mg", "80mg"], avgRetailPrice: 15, category: "cholesterol" },
  "lipitor": { genericName: "Atorvastatin", forms: ["tablet"], dosages: ["10mg", "20mg", "40mg", "80mg"], avgRetailPrice: 380, category: "cholesterol" },
  "metformin": { genericName: null, forms: ["tablet", "tablet ER"], dosages: ["500mg", "850mg", "1000mg"], avgRetailPrice: 12, category: "diabetes" },
  "lisinopril": { genericName: null, forms: ["tablet"], dosages: ["5mg", "10mg", "20mg", "40mg"], avgRetailPrice: 10, category: "blood pressure" },
  "amlodipine": { genericName: null, forms: ["tablet"], dosages: ["2.5mg", "5mg", "10mg"], avgRetailPrice: 12, category: "blood pressure" },
  "omeprazole": { genericName: null, forms: ["capsule", "tablet"], dosages: ["20mg", "40mg"], avgRetailPrice: 18, category: "acid reflux" },
  "sertraline": { genericName: null, forms: ["tablet"], dosages: ["25mg", "50mg", "100mg"], avgRetailPrice: 14, category: "depression" },
  "levothyroxine": { genericName: null, forms: ["tablet"], dosages: ["25mcg", "50mcg", "75mcg", "100mcg", "125mcg"], avgRetailPrice: 16, category: "thyroid" },
  "albuterol": { genericName: null, forms: ["inhaler", "nebulizer solution"], dosages: ["90mcg/actuation", "0.083%"], avgRetailPrice: 65, category: "asthma" },
  "montelukast": { genericName: null, forms: ["tablet", "chewable tablet"], dosages: ["4mg", "5mg", "10mg"], avgRetailPrice: 22, category: "asthma" },
  "ozempic": { genericName: "Semaglutide", forms: ["injection pen"], dosages: ["0.25mg", "0.5mg", "1mg", "2mg"], avgRetailPrice: 935, category: "diabetes/weight" },
  "wegovy": { genericName: "Semaglutide", forms: ["injection pen"], dosages: ["0.25mg", "0.5mg", "1mg", "1.7mg", "2.4mg"], avgRetailPrice: 1350, category: "weight loss" },
  "humira": { genericName: "Adalimumab", forms: ["injection pen"], dosages: ["40mg/0.4mL", "40mg/0.8mL"], avgRetailPrice: 6900, category: "autoimmune" },
  "eliquis": { genericName: "Apixaban", forms: ["tablet"], dosages: ["2.5mg", "5mg"], avgRetailPrice: 580, category: "blood thinner" },
  "jardiance": { genericName: "Empagliflozin", forms: ["tablet"], dosages: ["10mg", "25mg"], avgRetailPrice: 560, category: "diabetes" },
  "dupixent": { genericName: "Dupilumab", forms: ["injection pen"], dosages: ["200mg", "300mg"], avgRetailPrice: 3800, category: "eczema/asthma" },
  "trulicity": { genericName: "Dulaglutide", forms: ["injection pen"], dosages: ["0.75mg", "1.5mg", "3mg", "4.5mg"], avgRetailPrice: 880, category: "diabetes" },
  "amoxicillin": { genericName: null, forms: ["capsule", "suspension"], dosages: ["250mg", "500mg", "875mg"], avgRetailPrice: 10, category: "antibiotic" },
  "azithromycin": { genericName: null, forms: ["tablet", "suspension"], dosages: ["250mg", "500mg"], avgRetailPrice: 15, category: "antibiotic" },
  "ibuprofen": { genericName: null, forms: ["tablet", "capsule"], dosages: ["200mg", "400mg", "600mg", "800mg"], avgRetailPrice: 8, category: "pain/inflammation" },
  "gabapentin": { genericName: null, forms: ["capsule", "tablet"], dosages: ["100mg", "300mg", "400mg", "600mg", "800mg"], avgRetailPrice: 15, category: "nerve pain" },
  "rosuvastatin": { genericName: null, forms: ["tablet"], dosages: ["5mg", "10mg", "20mg", "40mg"], avgRetailPrice: 18, category: "cholesterol" },
  "escitalopram": { genericName: null, forms: ["tablet"], dosages: ["5mg", "10mg", "20mg"], avgRetailPrice: 16, category: "depression/anxiety" },
  "losartan": { genericName: null, forms: ["tablet"], dosages: ["25mg", "50mg", "100mg"], avgRetailPrice: 14, category: "blood pressure" },
  "pantoprazole": { genericName: null, forms: ["tablet"], dosages: ["20mg", "40mg"], avgRetailPrice: 18, category: "acid reflux" },
};

function generatePharmacyPrices(drugName: string, avgRetail: number, quantity: number): GoodRxPrice[] {
  const quantityMultiplier = quantity / 30;
  const basePrice = avgRetail * quantityMultiplier;

  return [
    {
      pharmacyName: "Costco Pharmacy",
      pharmacyType: "retail",
      price: Math.round(basePrice * 0.55 * 100) / 100,
      priceWithCoupon: Math.round(basePrice * 0.4 * 100) / 100,
      couponCode: "GOODRX",
      distance: "3.2 mi",
      savings: `${Math.round((1 - 0.4) * 100)}%`,
      url: `https://www.goodrx.com/go/costco/${drugName.toLowerCase()}`,
    },
    {
      pharmacyName: "Walmart Pharmacy",
      pharmacyType: "retail",
      price: Math.round(basePrice * 0.65 * 100) / 100,
      priceWithCoupon: Math.round(basePrice * 0.45 * 100) / 100,
      couponCode: "GOODRX",
      distance: "1.8 mi",
      savings: `${Math.round((1 - 0.45) * 100)}%`,
      url: `https://www.goodrx.com/go/walmart/${drugName.toLowerCase()}`,
    },
    {
      pharmacyName: "CVS Pharmacy",
      pharmacyType: "retail",
      price: Math.round(basePrice * 0.9 * 100) / 100,
      priceWithCoupon: Math.round(basePrice * 0.5 * 100) / 100,
      couponCode: "GOODRX",
      distance: "0.5 mi",
      savings: `${Math.round((1 - 0.5) * 100)}%`,
      url: `https://www.goodrx.com/go/cvs/${drugName.toLowerCase()}`,
    },
    {
      pharmacyName: "Walgreens",
      pharmacyType: "retail",
      price: Math.round(basePrice * 0.95 * 100) / 100,
      priceWithCoupon: Math.round(basePrice * 0.55 * 100) / 100,
      couponCode: "GOODRX",
      distance: "0.8 mi",
      savings: `${Math.round((1 - 0.55) * 100)}%`,
      url: `https://www.goodrx.com/go/walgreens/${drugName.toLowerCase()}`,
    },
    {
      pharmacyName: "Amazon Pharmacy",
      pharmacyType: "online",
      price: Math.round(basePrice * 0.6 * 100) / 100,
      priceWithCoupon: Math.round(basePrice * 0.42 * 100) / 100,
      couponCode: "PRIME",
      distance: null,
      savings: `${Math.round((1 - 0.42) * 100)}%`,
      url: `https://pharmacy.amazon.com/search?drugName=${drugName.toLowerCase()}`,
    },
    {
      pharmacyName: "Mark Cuban Cost Plus Drugs",
      pharmacyType: "mail_order",
      price: Math.round(basePrice * 0.35 * 100) / 100,
      priceWithCoupon: null,
      couponCode: null,
      distance: null,
      savings: `${Math.round((1 - 0.35) * 100)}%`,
      url: `https://costplusdrugs.com/medications/${drugName.toLowerCase()}`,
    },
    {
      pharmacyName: "Kroger Pharmacy",
      pharmacyType: "retail",
      price: Math.round(basePrice * 0.7 * 100) / 100,
      priceWithCoupon: Math.round(basePrice * 0.48 * 100) / 100,
      couponCode: "GOODRX",
      distance: "2.1 mi",
      savings: `${Math.round((1 - 0.48) * 100)}%`,
      url: `https://www.goodrx.com/go/kroger/${drugName.toLowerCase()}`,
    },
    {
      pharmacyName: "Rite Aid",
      pharmacyType: "retail",
      price: Math.round(basePrice * 0.85 * 100) / 100,
      priceWithCoupon: Math.round(basePrice * 0.52 * 100) / 100,
      couponCode: "GOODRX",
      distance: "1.2 mi",
      savings: `${Math.round((1 - 0.52) * 100)}%`,
      url: `https://www.goodrx.com/go/riteaid/${drugName.toLowerCase()}`,
    },
  ].sort((a, b) => (a.priceWithCoupon || a.price) - (b.priceWithCoupon || b.price));
}

router.get("/search", (req, res) => {
  try {
    const drugName = (req.query.drug as string || "").toLowerCase().trim();
    const quantity = parseInt(req.query.quantity as string) || 30;
    const form = (req.query.form as string) || "";
    const dosage = (req.query.dosage as string) || "";

    if (!drugName) {
      return res.status(400).json({ error: "drug name is required" });
    }

    const drug = drugDatabase[drugName];
    if (!drug) {
      const partialMatches = Object.entries(drugDatabase)
        .filter(([key, val]) =>
          key.includes(drugName) ||
          (val.genericName && val.genericName.toLowerCase().includes(drugName))
        )
        .map(([key, val]) => ({
          name: key.charAt(0).toUpperCase() + key.slice(1),
          genericName: val.genericName,
          category: val.category,
        }));

      if (partialMatches.length > 0) {
        return res.json({ suggestions: partialMatches, message: `Did you mean one of these?` });
      }

      return res.json({
        drugName,
        message: "Drug not found in our database. Try searching on GoodRx directly.",
        searchUrl: `https://www.goodrx.com/${drugName}`,
        prices: [],
      });
    }

    const selectedForm = form || drug.forms[0];
    const selectedDosage = dosage || drug.dosages[Math.floor(drug.dosages.length / 2)];
    const prices = generatePharmacyPrices(drugName, drug.avgRetailPrice, quantity);
    const lowestPrice = prices[0]?.priceWithCoupon || prices[0]?.price || 0;

    const result: DrugPriceResult = {
      drugName: drugName.charAt(0).toUpperCase() + drugName.slice(1),
      genericName: drug.genericName,
      form: selectedForm,
      dosage: selectedDosage,
      quantity,
      prices,
      averageRetailPrice: Math.round(drug.avgRetailPrice * (quantity / 30) * 100) / 100,
      lowestPrice,
      bestSavings: `${Math.round((1 - lowestPrice / (drug.avgRetailPrice * (quantity / 30))) * 100)}%`,
      lastUpdated: new Date().toISOString(),
    };

    res.json({
      ...result,
      availableForms: drug.forms,
      availableDosages: drug.dosages,
      isGeneric: !drug.genericName,
      genericAlternative: drug.genericName ? null : undefined,
      brandAlternatives: drug.genericName
        ? Object.entries(drugDatabase)
            .filter(([_, v]) => v.genericName?.toLowerCase() === drugName)
            .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1))
        : undefined,
      disclaimer: "Prices shown are estimates and may vary. GoodRx coupons are not insurance. Always verify pricing at the pharmacy.",
    });
  } catch (error: any) {
    console.error("[GoodRx] Search error:", error.message);
    res.status(500).json({ error: "Failed to search drug prices" });
  }
});

router.get("/popular", (_req, res) => {
  const popular = [
    { name: "Metformin", category: "Diabetes", lowestPrice: 4.20, avgRetail: 12 },
    { name: "Lisinopril", category: "Blood Pressure", lowestPrice: 3.50, avgRetail: 10 },
    { name: "Atorvastatin", category: "Cholesterol", lowestPrice: 5.25, avgRetail: 15 },
    { name: "Omeprazole", category: "Acid Reflux", lowestPrice: 6.30, avgRetail: 18 },
    { name: "Sertraline", category: "Depression", lowestPrice: 4.90, avgRetail: 14 },
    { name: "Amoxicillin", category: "Antibiotic", lowestPrice: 3.50, avgRetail: 10 },
    { name: "Albuterol", category: "Asthma", lowestPrice: 22.75, avgRetail: 65 },
    { name: "Levothyroxine", category: "Thyroid", lowestPrice: 5.60, avgRetail: 16 },
    { name: "Gabapentin", category: "Nerve Pain", lowestPrice: 5.25, avgRetail: 15 },
    { name: "Losartan", category: "Blood Pressure", lowestPrice: 4.90, avgRetail: 14 },
  ];

  res.json({
    popular: popular.map(p => ({
      ...p,
      savings: `${Math.round((1 - p.lowestPrice / p.avgRetail) * 100)}% off`,
    })),
  });
});

router.get("/categories", (_req, res) => {
  const categories = new Map<string, number>();
  for (const [_, drug] of Object.entries(drugDatabase)) {
    categories.set(drug.category, (categories.get(drug.category) || 0) + 1);
  }
  res.json({
    categories: Array.from(categories.entries()).map(([name, count]) => ({ name, count })),
  });
});

export default router;
