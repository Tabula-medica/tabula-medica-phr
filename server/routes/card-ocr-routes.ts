import { Router } from "express";
import OpenAI from "openai";

const router = Router();
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface CardOCRResult {
  cardType: "insurance" | "discount" | "medicare" | "medicaid" | "va" | "unknown";
  confidence: number;
  fields: ExtractedCardFields;
  pharmacyRouting: PharmacyRouting | null;
  rawText: string;
  processingTime: number;
  provider: string;
}

interface ExtractedCardFields {
  insurerName?: string;
  planName?: string;
  memberId?: string;
  groupNumber?: string;
  subscriberName?: string;
  dependents?: string[];
  effectiveDate?: string;
  expirationDate?: string;
  planType?: string;
  copayPrimary?: string;
  copaySpecialist?: string;
  copayER?: string;
  copayUrgentCare?: string;
  deductible?: string;
  rxBin?: string;
  rxPcn?: string;
  rxGroup?: string;
  rxId?: string;
  phoneCustomerService?: string;
  phonePreAuth?: string;
  phoneMentalHealth?: string;
  payerId?: string;
  networkType?: string;
  discountProgramName?: string;
  discountPercentage?: string;
}

interface PharmacyRouting {
  bin: string;
  pcn: string;
  group: string;
  memberId: string;
  payerName: string;
  isValidRouting: boolean;
  routingNotes: string;
}

const knownBINs: Record<string, { payerName: string; pcnPattern: string; notes: string }> = {
  "003858": { payerName: "OptumRx / UnitedHealthcare", pcnPattern: "ADV", notes: "Major PBM" },
  "004336": { payerName: "Express Scripts", pcnPattern: "MEDDADV", notes: "Cigna PBM" },
  "610502": { payerName: "CVS Caremark", pcnPattern: "OHCP", notes: "CVS Health PBM" },
  "610591": { payerName: "CVS Caremark", pcnPattern: "", notes: "CVS Health" },
  "015581": { payerName: "Navitus Health Solutions", pcnPattern: "", notes: "Independent PBM" },
  "017010": { payerName: "MedImpact", pcnPattern: "", notes: "Independent PBM" },
  "600428": { payerName: "Magellan Rx Management", pcnPattern: "", notes: "Specialty PBM" },
  "610014": { payerName: "Elixir / Rite Aid", pcnPattern: "", notes: "Rite Aid PBM" },
  "610279": { payerName: "Humana Pharmacy Solutions", pcnPattern: "", notes: "Humana PBM" },
  "011500": { payerName: "GoodRx", pcnPattern: "GDC", notes: "Discount card - NOT insurance" },
  "610602": { payerName: "SingleCare", pcnPattern: "", notes: "Discount card - NOT insurance" },
  "015995": { payerName: "RxSaver", pcnPattern: "", notes: "Discount card" },
  "020099": { payerName: "Optum Discount Program", pcnPattern: "", notes: "Discount card" },
  "610020": { payerName: "ScriptSave WellRx", pcnPattern: "", notes: "Discount card" },
};

function validatePharmacyRouting(fields: ExtractedCardFields): PharmacyRouting | null {
  if (!fields.rxBin) return null;

  const bin = fields.rxBin.replace(/\D/g, "");
  const knownBin = knownBINs[bin];

  return {
    bin: bin,
    pcn: fields.rxPcn || "",
    group: fields.rxGroup || "",
    memberId: fields.rxId || fields.memberId || "",
    payerName: knownBin?.payerName || "Unknown PBM",
    isValidRouting: bin.length === 6 && !!fields.rxPcn,
    routingNotes: knownBin
      ? `${knownBin.notes}. ${knownBin.payerName} identified by BIN ${bin}.`
      : `BIN ${bin} not in our known database. Verify with pharmacy.`,
  };
}

router.post("/scan", async (req, res) => {
  const startTime = Date.now();

  try {
    const { imageBase64, imageUrl, side } = req.body;

    if (!imageBase64 && !imageUrl) {
      return res.status(400).json({ error: "Either imageBase64 or imageUrl is required" });
    }

    const imageContent = imageUrl
      ? { type: "image_url" as const, image_url: { url: imageUrl } }
      : { type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${imageBase64}` } };

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert medical card OCR system. Extract ALL fields from this insurance, discount, or medical ID card image. 
Return a JSON object with these fields (use null for fields not visible):
{
  "cardType": "insurance" | "discount" | "medicare" | "medicaid" | "va" | "unknown",
  "confidence": 0.0-1.0,
  "insurerName": "string",
  "planName": "string",
  "memberId": "string",
  "groupNumber": "string",
  "subscriberName": "string",
  "effectiveDate": "string",
  "expirationDate": "string",
  "planType": "HMO/PPO/EPO/POS/HDHP etc",
  "copayPrimary": "$XX",
  "copaySpecialist": "$XX",
  "copayER": "$XX",
  "copayUrgentCare": "$XX",
  "deductible": "$X,XXX",
  "rxBin": "6 digits",
  "rxPcn": "string",
  "rxGroup": "string",
  "rxId": "string",
  "phoneCustomerService": "string",
  "phonePreAuth": "string",
  "payerId": "string",
  "networkType": "string",
  "discountProgramName": "string (for discount cards)",
  "discountPercentage": "string (for discount cards)"
}
Be precise with BIN/PCN/Group numbers - these are critical for pharmacy routing. Return ONLY valid JSON.`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Extract all information from this ${side || "front"} of the medical card:` },
            imageContent,
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 1000,
    });

    const rawResponse = response.choices[0]?.message?.content || "{}";
    let parsed: any;
    try {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch?.[0] || "{}");
    } catch {
      parsed = {};
    }

    const fields: ExtractedCardFields = {
      insurerName: parsed.insurerName || undefined,
      planName: parsed.planName || undefined,
      memberId: parsed.memberId || undefined,
      groupNumber: parsed.groupNumber || undefined,
      subscriberName: parsed.subscriberName || undefined,
      effectiveDate: parsed.effectiveDate || undefined,
      expirationDate: parsed.expirationDate || undefined,
      planType: parsed.planType || undefined,
      copayPrimary: parsed.copayPrimary || undefined,
      copaySpecialist: parsed.copaySpecialist || undefined,
      copayER: parsed.copayER || undefined,
      copayUrgentCare: parsed.copayUrgentCare || undefined,
      deductible: parsed.deductible || undefined,
      rxBin: parsed.rxBin || undefined,
      rxPcn: parsed.rxPcn || undefined,
      rxGroup: parsed.rxGroup || undefined,
      rxId: parsed.rxId || undefined,
      phoneCustomerService: parsed.phoneCustomerService || undefined,
      phonePreAuth: parsed.phonePreAuth || undefined,
      payerId: parsed.payerId || undefined,
      networkType: parsed.networkType || undefined,
      discountProgramName: parsed.discountProgramName || undefined,
      discountPercentage: parsed.discountPercentage || undefined,
    };

    const pharmacyRouting = validatePharmacyRouting(fields);

    const result: CardOCRResult = {
      cardType: parsed.cardType || "unknown",
      confidence: parsed.confidence || 0.85,
      fields,
      pharmacyRouting,
      rawText: rawResponse,
      processingTime: Date.now() - startTime,
      provider: "ai-vision",
    };

    res.json(result);
  } catch (error: any) {
    console.error("[CardOCR] Scan error:", error.message);
    res.status(500).json({
      error: "Failed to process card image",
      fallback: "Please try again or enter your card details manually.",
      processingTime: Date.now() - startTime,
    });
  }
});

router.post("/validate-routing", (req, res) => {
  const { bin, pcn, group, memberId } = req.body;

  if (!bin) {
    return res.status(400).json({ error: "BIN is required" });
  }

  const cleanBin = bin.replace(/\D/g, "");
  const knownBin = knownBINs[cleanBin];

  res.json({
    bin: cleanBin,
    pcn: pcn || "",
    group: group || "",
    memberId: memberId || "",
    isValid: cleanBin.length === 6,
    payerName: knownBin?.payerName || "Unknown",
    payerNotes: knownBin?.notes || "BIN not found in database",
    isDiscountCard: knownBin?.notes?.includes("Discount") || false,
    routing: {
      canRouteElectronically: !!knownBin && cleanBin.length === 6 && !!pcn,
      recommendation: knownBin
        ? `Route claims to ${knownBin.payerName} using BIN ${cleanBin}`
        : "Verify BIN with the pharmacy or call the number on the card",
    },
  });
});

router.get("/known-bins", (_req, res) => {
  const bins = Object.entries(knownBINs).map(([bin, info]) => ({
    bin,
    payerName: info.payerName,
    notes: info.notes,
    isDiscountCard: info.notes.includes("Discount") || info.notes.includes("discount"),
  }));

  res.json({
    totalKnown: bins.length,
    bins,
    categories: {
      insurance: bins.filter(b => !b.isDiscountCard).length,
      discount: bins.filter(b => b.isDiscountCard).length,
    },
  });
});

router.post("/merge-sides", (req, res) => {
  const { front, back } = req.body;

  if (!front && !back) {
    return res.status(400).json({ error: "At least one card side is required" });
  }

  const merged: ExtractedCardFields = { ...front?.fields, ...back?.fields };
  if (front?.fields?.insurerName && !merged.insurerName) {
    merged.insurerName = front.fields.insurerName;
  }

  const pharmacyRouting = validatePharmacyRouting(merged);

  res.json({
    cardType: front?.cardType || back?.cardType || "unknown",
    confidence: Math.max(front?.confidence || 0, back?.confidence || 0),
    fields: merged,
    pharmacyRouting,
    completeness: {
      hasInsurer: !!merged.insurerName,
      hasMemberId: !!merged.memberId,
      hasGroup: !!merged.groupNumber,
      hasRxRouting: !!(merged.rxBin && merged.rxPcn),
      hasCopays: !!(merged.copayPrimary || merged.copaySpecialist),
      hasPhone: !!merged.phoneCustomerService,
      score: [
        merged.insurerName, merged.memberId, merged.groupNumber,
        merged.rxBin, merged.rxPcn, merged.copayPrimary, merged.phoneCustomerService,
      ].filter(Boolean).length / 7 * 100,
    },
  });
});

export default router;
