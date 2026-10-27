// @ts-nocheck
import { Router, Request, Response } from "express";
import axios from "axios";

export type CardType =
  | "INSURANCE_FRONT"
  | "INSURANCE_BACK"
  | "DISCOUNT_CARD"
  | "PHARMACY_CARD"
  | "HSA_FSA_CARD"
  | "MEDICARE"
  | "MEDICAID"
  | "VA_ID"
  | "UNKNOWN";

export interface ExtractedCardData {
  cardType: CardType;
  confidence: number;
  isLive: boolean;

  memberId?: string;
  memberName?: string;
  groupNumber?: string;
  planName?: string;
  planType?: string;
  issuerName?: string;
  effectiveDate?: string;
  expirationDate?: string;

  rxBin?: string;
  rxPcn?: string;
  rxGroup?: string;
  rxId?: string;

  copays?: {
    primaryCare?: string;
    specialist?: string;
    urgentCare?: string;
    emergencyRoom?: string;
    genericRx?: string;
    preferredBrandRx?: string;
    specialtyRx?: string;
  };

  claimsAddress?: string;
  claimsPhone?: string;
  customerServicePhone?: string;
  payerIdEdi?: string;

  network?: string;
  deductible?: string;

  rawFields: Record<string, string>;
  scanTimestamp: string;
}

export interface CardScanResult {
  success: boolean;
  card: ExtractedCardData | null;
  error?: string;
  processingTimeMs: number;
}

interface AzapiOcrResponse {
  status: string;
  data?: {
    fields?: Record<string, { value: string; confidence: number }>;
    card_type?: string;
    overall_confidence?: number;
  };
  error?: string;
}

const KNOWN_BIN_DIRECTORY: Record<string, { processor: string; network: string }> = {
  "003858": { processor: "OptumRx", network: "OptumRx PBM" },
  "004336": { processor: "Express Scripts", network: "Express Scripts / Cigna" },
  "610014": { processor: "Caremark / CVS Health", network: "CVS Caremark" },
  "610591": { processor: "Caremark / CVS Health", network: "CVS Caremark" },
  "015581": { processor: "Elixir Solutions", network: "Rite Aid / Elixir" },
  "610239": { processor: "Medco / Express Scripts", network: "Express Scripts" },
  "017010": { processor: "MedImpact", network: "MedImpact Direct" },
  "600428": { processor: "MedImpact", network: "MedImpact Direct" },
  "012345": { processor: "GoodRx", network: "GoodRx Discount" },
  "015814": { processor: "Navitus", network: "Navitus Health Solutions" },
  "610279": { processor: "Humana Pharmacy", network: "Humana" },
  "610097": { processor: "Prime Therapeutics", network: "Prime Therapeutics / BCBS" },
  "005947": { processor: "Magellan Rx", network: "Magellan Health" },
  "004939": { processor: "Costco Pharmacy", network: "Costco Wholesale" },
  "610455": { processor: "EnvisionRx", network: "EnvisionRx / Rite Aid" },
  "020107": { processor: "Maxor", network: "Maxor National" },
  "610494": { processor: "WellDyne", network: "WellDyne" },
  "015905": { processor: "Argus Health Systems", network: "Argus / OptumRx" },
  "610602": { processor: "Prescription Solutions", network: "UnitedHealth / OptumRx" },
  "610127": { processor: "Anthem BlueCross", network: "Anthem / Elevance" },
};

function classifyCardType(fields: Record<string, string>): CardType {
  const allText = (Object.keys(fields).join(" ") + " " + Object.values(fields).join(" ")).toLowerCase();
  if (/medicare/i.test(allText)) return "MEDICARE";
  if (/medicaid|medi-cal|chip/i.test(allText)) return "MEDICAID";
  if (/veteran|va\s|department of veteran/i.test(allText)) return "VA_ID";
  if (/hsa|fsa|health savings|flexible spending/i.test(allText)) return "HSA_FSA_CARD";
  if (/goodrx|rxsaver|singlecare|discount/i.test(allText)) return "DISCOUNT_CARD";
  if (/rx\s?bin|rx\s?pcn|pharmacy/i.test(allText) && !/member|group|plan/i.test(allText)) return "PHARMACY_CARD";
  if (/bin|pcn|member|group|plan|copay|deductible|network|insurance|ppo|hmo|epo|pos/i.test(allText)) {
    if (/claims.?address|send.?claims|payer.?id|electronic.?payer|pre.?auth/i.test(allText)) return "INSURANCE_BACK";
    return "INSURANCE_FRONT";
  }
  return "UNKNOWN";
}

function normalizeFieldKey(key: string): string {
  return key.toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function extractFromFields(raw: Record<string, string>): ExtractedCardData {
  const norm: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    norm[normalizeFieldKey(k)] = v.trim();
  }

  const find = (...patterns: string[]): string | undefined => {
    for (const p of patterns) {
      for (const [k, v] of Object.entries(norm)) {
        if (k === p && v) return v;
      }
    }
    for (const p of patterns) {
      for (const [k, v] of Object.entries(norm)) {
        if (k.startsWith(p) && v) return v;
      }
    }
    for (const p of patterns) {
      if (p.length >= 4) {
        for (const [k, v] of Object.entries(norm)) {
          if (k.includes(p) && v) return v;
        }
      }
    }
    return undefined;
  };

  const cardType = classifyCardType(raw);

  const rxBin = find("rx_bin", "rxbin", "bin");
  const binInfo = rxBin ? KNOWN_BIN_DIRECTORY[rxBin] : undefined;

  return {
    cardType,
    confidence: 0,
    isLive: false,
    memberId: find("member_id", "memberid", "id_number", "subscriber_id", "subscriber"),
    memberName: find("member_name", "name", "subscriber_name", "cardholder"),
    groupNumber: find("group_number", "group_no", "group", "grp"),
    planName: find("plan_name", "plan", "health_plan"),
    planType: find("plan_type", "type", "product"),
    issuerName: find("issuer", "insurance_company", "insurer", "carrier", "payer") ?? binInfo?.network,
    effectiveDate: find("effective_date", "eff_date", "start_date", "effective"),
    expirationDate: find("expiration_date", "exp_date", "end_date", "expiration", "expires"),
    rxBin,
    rxPcn: find("rx_pcn", "rxpcn", "pcn"),
    rxGroup: find("rx_group", "rxgroup", "rx_grp"),
    rxId: find("rx_id", "rxid", "rx_member"),
    copays: {
      primaryCare: find("pcp_copay", "primary_care", "office_visit"),
      specialist: find("specialist_copay", "specialist"),
      urgentCare: find("urgent_care", "urgentcare"),
      emergencyRoom: find("er_copay", "emergency"),
      genericRx: find("generic_rx", "generic_copay", "tier_1"),
      preferredBrandRx: find("preferred_brand", "brand_copay", "tier_2"),
      specialtyRx: find("specialty_rx", "specialty_copay", "tier_3", "tier_4"),
    },
    claimsAddress: find("claims_address", "send_claims_to", "claims"),
    claimsPhone: find("claims_phone"),
    customerServicePhone: find("customer_service", "member_services", "phone"),
    payerIdEdi: find("payer_id", "edi_payer", "electronic_payer"),
    network: find("network", "provider_network") ?? binInfo?.processor,
    rawFields: raw,
    scanTimestamp: new Date().toISOString(),
  };
}

async function scanWithAzapi(imageBase64: string, apiKey: string): Promise<ExtractedCardData> {
  const response = await axios.post<AzapiOcrResponse>(
    "https://api.azapi.ai/v1/ocr/medical-card",
    {
      image: imageBase64,
      extract_fields: true,
      card_type: "auto",
      enhance_image: true,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    }
  );

  const result = response.data;
  if (result.status !== "success" || !result.data?.fields) {
    throw new Error(result.error ?? "AZAPI OCR returned no data");
  }

  const rawFields: Record<string, string> = {};
  for (const [k, v] of Object.entries(result.data.fields)) {
    if (v.value) rawFields[k] = v.value;
  }

  const extracted = extractFromFields(rawFields);
  extracted.confidence = result.data.overall_confidence ?? 0.85;
  extracted.isLive = true;

  const azapiCardType = result.data.card_type?.toUpperCase();
  if (azapiCardType && azapiCardType !== "UNKNOWN") {
    if (azapiCardType.includes("MEDICARE")) extracted.cardType = "MEDICARE";
    else if (azapiCardType.includes("MEDICAID")) extracted.cardType = "MEDICAID";
    else if (azapiCardType.includes("DISCOUNT")) extracted.cardType = "DISCOUNT_CARD";
    else if (azapiCardType.includes("HSA") || azapiCardType.includes("FSA")) extracted.cardType = "HSA_FSA_CARD";
  }

  return extracted;
}

function scanWithDemoEngine(rawFields: Record<string, string>): ExtractedCardData {
  const extracted = extractFromFields(rawFields);
  extracted.confidence = 0.92;
  extracted.isLive = false;
  return extracted;
}

const DEMO_CARDS: Record<string, Record<string, string>> = {
  insurance_front: {
    "Insurance Company": "BlueCross BlueShield of Illinois",
    "Plan Name": "Blue PPO 500",
    "Plan Type": "PPO",
    "Member Name": "Jane A. Smith",
    "Member ID": "XYK928471305",
    "Group Number": "G-80214",
    "Effective Date": "01/01/2026",
    "PCP Copay": "$25",
    "Specialist Copay": "$50",
    "Urgent Care": "$75",
    "ER Copay": "$250",
    "Network": "BlueCard PPO National",
    "RxBIN": "610097",
    "RxPCN": "BCBSRX",
    "RxGroup": "RX8021",
    "Generic Rx": "$10",
    "Preferred Brand": "$35",
    "Specialty Rx": "$100",
  },
  insurance_back: {
    "Claims Address": "PO Box 805107, Chicago, IL 60680-4112",
    "Claims Phone": "1-800-262-2583",
    "Customer Service": "1-800-538-8833",
    "Payer ID": "00621",
    "Electronic Payer": "BCBSIL",
    "Send Claims To": "BlueCross BlueShield of IL, PO Box 805107, Chicago, IL 60680",
    "Provider Network": "BlueCard PPO",
    "Pre-Authorization": "1-800-443-8821",
  },
  discount_card: {
    "Program": "GoodRx Gold",
    "Member ID": "GRX-7829104",
    "RxBIN": "012345",
    "RxPCN": "GDC",
    "RxGroup": "GOLD2026",
    "Customer Service": "1-855-268-2822",
    "Type": "Discount Card",
    "Website": "goodrx.com/gold",
  },
  pharmacy_card: {
    "Pharmacy Benefit Manager": "OptumRx",
    "RxBIN": "003858",
    "RxPCN": "ADV",
    "RxGroup": "OPTRX5544",
    "Rx Member ID": "OPT-382910473",
    "Generic Rx": "$5",
    "Preferred Brand": "$25",
    "Specialty Rx": "$75",
    "Customer Service": "1-800-788-4863",
    "Mail Order": "1-800-562-6223",
  },
  hsa_card: {
    "Type": "Health Savings Account",
    "Bank": "HealthEquity",
    "Cardholder": "Jane A. Smith",
    "Card Number Last 4": "4829",
    "Effective Date": "01/01/2026",
    "Customer Service": "1-866-346-5800",
    "Network": "Visa",
  },
};

export function lookupBin(bin: string): { processor: string; network: string } | null {
  return KNOWN_BIN_DIRECTORY[bin] ?? null;
}

export function createCardScanRouter(): Router {
  const router = Router();

  router.post("/scan", async (req: Request, res: Response) => {
    const start = Date.now();
    try {
      const { image, cardSide } = req.body as { image?: string; cardSide?: "front" | "back" };

      if (!image || typeof image !== "string") {
        return res.status(400).json({ error: "Base64-encoded card image required in 'image' field" });
      }

      if (image.length > 10_000_000) {
        return res.status(400).json({ error: "Image too large. Maximum 7.5MB." });
      }

      const b64Body = image.replace(/^data:image\/[a-z]+;base64,/, "");
      if (!/^[A-Za-z0-9+/\n\r]+=*$/.test(b64Body.slice(0, 200))) {
        return res.status(400).json({ error: "Invalid image encoding. Provide a base64-encoded image." });
      }

      const apiKey = process.env.AZAPI_API_KEY;
      let card: ExtractedCardData;

      if (apiKey) {
        card = await scanWithAzapi(image, apiKey);
      } else {
        const demoKey = cardSide === "back" ? "insurance_back" : "insurance_front";
        card = scanWithDemoEngine(DEMO_CARDS[demoKey]);
      }

      const result: CardScanResult = {
        success: true,
        card,
        processingTimeMs: Date.now() - start,
      };

      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        card: null,
        error: error.message ?? "Card scan failed",
        processingTimeMs: Date.now() - start,
      } satisfies CardScanResult);
    }
  });

  router.post("/scan/fields", async (req: Request, res: Response) => {
    const start = Date.now();
    try {
      const { fields } = req.body as { fields?: Record<string, string> };

      if (!fields || typeof fields !== "object" || Object.keys(fields).length === 0) {
        return res.status(400).json({ error: "Non-empty 'fields' object required" });
      }

      const card = scanWithDemoEngine(fields);

      res.json({
        success: true,
        card,
        processingTimeMs: Date.now() - start,
      } satisfies CardScanResult);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        card: null,
        error: error.message ?? "Field extraction failed",
        processingTimeMs: Date.now() - start,
      } satisfies CardScanResult);
    }
  });

  router.get("/bin/:bin", (req: Request, res: Response) => {
    const bin = req.params.bin?.replace(/\D/g, "");
    if (!bin || bin.length !== 6) {
      return res.status(400).json({ error: "BIN must be a 6-digit number" });
    }
    const info = lookupBin(bin);
    if (!info) {
      return res.status(404).json({ error: "BIN not found in directory", bin });
    }
    res.json({ bin, ...info });
  });

  router.get("/demo/:cardType", (req: Request, res: Response) => {
    const cardType = req.params.cardType?.toLowerCase();
    const demoData = DEMO_CARDS[cardType];
    if (!demoData) {
      return res.status(404).json({
        error: "Unknown demo card type",
        available: Object.keys(DEMO_CARDS),
      });
    }
    const card = scanWithDemoEngine(demoData);
    res.json({ success: true, card, processingTimeMs: 0 });
  });

  return router;
}
