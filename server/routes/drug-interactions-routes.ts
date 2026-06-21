import { Router } from "express";
import { z } from "zod";

const router = Router();

const FDA_BASE = "https://api.fda.gov";
const FDA_API_KEY = process.env.OPENFDA_API_KEY;
const fdaUrl = (path: string, params: Record<string, string>) => {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v).replace(/%2B/g, "+")}`);
  }
  if (FDA_API_KEY) parts.push(`api_key=${encodeURIComponent(FDA_API_KEY)}`);
  return `${FDA_BASE}${path}?${parts.join("&")}`;
};

interface DrugLabel {
  brandName: string;
  genericName: string;
  manufacturer: string;
  drugInteractionsText: string[];
  warnings: string[];
  contraindications: string[];
  boxedWarning: string[];
}

interface InteractionFinding {
  pair: [string, string];
  severity: "contraindicated" | "major" | "moderate" | "minor" | "informational";
  source: "openFDA";
  evidence: string;
  recommendation: string;
}

const SEVERITY_KEYWORDS: Array<{ severity: InteractionFinding["severity"]; words: RegExp }> = [
  { severity: "contraindicated", words: /\b(contraindicat\w*|do not (use|administer|combine)|absolutely avoid)\b/i },
  { severity: "major", words: /\b(serious|severe|life[- ]threatening|fatal|black ?box|warning)\b/i },
  { severity: "moderate", words: /\b(caution|monitor|adjust dose|reduce dose|consider)\b/i },
  { severity: "minor", words: /\b(may (increase|decrease)|possible|theoretical)\b/i },
];

const cache = new Map<string, { at: number; label: DrugLabel | null }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

async function fetchDrugLabel(query: string): Promise<DrugLabel | null> {
  const key = query.toLowerCase().trim();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.label;

  const search = `(openfda.brand_name:"${query}"+OR+openfda.generic_name:"${query}")`;
  const url = fdaUrl("/drug/label.json", { search, limit: "1" });
  try {
    const res = await fetch(url);
    if (!res.ok) {
      cache.set(key, { at: Date.now(), label: null });
      return null;
    }
    const json = await res.json();
    const r = json.results?.[0];
    if (!r) {
      cache.set(key, { at: Date.now(), label: null });
      return null;
    }
    const label: DrugLabel = {
      brandName: r.openfda?.brand_name?.[0] ?? query,
      genericName: r.openfda?.generic_name?.[0] ?? "",
      manufacturer: r.openfda?.manufacturer_name?.[0] ?? "",
      drugInteractionsText: r.drug_interactions ?? [],
      warnings: r.warnings ?? r.warnings_and_cautions ?? [],
      contraindications: r.contraindications ?? [],
      boxedWarning: r.boxed_warning ?? [],
    };
    cache.set(key, { at: Date.now(), label });
    return label;
  } catch {
    return null;
  }
}

function classifyEvidence(text: string): InteractionFinding["severity"] {
  for (const { severity, words } of SEVERITY_KEYWORDS) {
    if (words.test(text)) return severity;
  }
  return "informational";
}

function extractMatchingSentences(haystack: string, needle: string): string[] {
  const re = new RegExp(`[^.!?]*\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b[^.!?]*[.!?]`, "gi");
  const matches = haystack.match(re) ?? [];
  return matches.map((m) => m.trim()).slice(0, 4);
}

function findInteractionsInLabel(
  source: DrugLabel,
  target: DrugLabel,
): { evidence: string[]; severity: InteractionFinding["severity"] } {
  const candidates = [target.brandName, target.genericName].filter(Boolean);
  const allText = source.drugInteractionsText.join(" \n ");
  let evidence: string[] = [];
  let severity: InteractionFinding["severity"] = "informational";
  for (const candidate of candidates) {
    const found = extractMatchingSentences(allText, candidate);
    if (found.length) {
      evidence = evidence.concat(found);
      for (const sentence of found) {
        const s = classifyEvidence(sentence);
        if (severityRank(s) > severityRank(severity)) severity = s;
      }
    }
  }
  evidence = Array.from(new Set(evidence)).slice(0, 4);
  return { evidence, severity };
}

function severityRank(s: InteractionFinding["severity"]): number {
  return ["informational", "minor", "moderate", "major", "contraindicated"].indexOf(s);
}

function recommendationFor(severity: InteractionFinding["severity"]): string {
  switch (severity) {
    case "contraindicated":
      return "These medications should not be combined. Contact your prescriber before taking together.";
    case "major":
      return "Serious interaction reported. Discuss with your pharmacist or doctor before combining.";
    case "moderate":
      return "Monitor for side effects and let your care team know you take both.";
    case "minor":
      return "Possible interaction noted. Generally manageable but worth mentioning at your next visit.";
    case "informational":
      return "No significant interaction documented in FDA labeling for this pair.";
  }
}

router.get("/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) return res.json({ results: [] });
  try {
    const url = fdaUrl("/drug/ndc.json", {
      search: `(brand_name:"${q}"+OR+generic_name:"${q}")`,
      limit: "10",
    });
    const r = await fetch(url);
    if (!r.ok) return res.json({ results: [] });
    const json = await r.json();
    const seen = new Set<string>();
    const results = (json.results ?? [])
      .map((x: any) => ({
        brandName: x.brand_name ?? "",
        genericName: x.generic_name ?? "",
        manufacturer: x.labeler_name ?? "",
        dosageForm: x.dosage_form ?? "",
      }))
      .filter((d: any) => {
        const k = `${d.brandName}|${d.genericName}`.toLowerCase();
        if (!d.brandName || seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 8);
    res.json({ results });
  } catch (err) {
    res.json({ results: [] });
  }
});

const checkBody = z.object({
  drugs: z.array(z.string().min(1)).min(2).max(8),
});

router.post("/check", async (req, res) => {
  const parsed = checkBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Provide 2 to 8 drug names in 'drugs'." });
  }
  const drugs = Array.from(new Set(parsed.data.drugs.map((d) => d.trim()).filter(Boolean)));

  const labels = await Promise.all(drugs.map((d) => fetchDrugLabel(d)));
  const labelMap = new Map<string, DrugLabel | null>();
  drugs.forEach((d, i) => labelMap.set(d, labels[i]));

  const unknown = drugs.filter((d) => !labelMap.get(d));
  const known = drugs.filter((d) => labelMap.get(d));
  const findings: InteractionFinding[] = [];

  for (let i = 0; i < known.length; i++) {
    for (let j = i + 1; j < known.length; j++) {
      const a = labelMap.get(known[i])!;
      const b = labelMap.get(known[j])!;
      const aToB = findInteractionsInLabel(a, b);
      const bToA = findInteractionsInLabel(b, a);
      const allEvidence = Array.from(new Set([...aToB.evidence, ...bToA.evidence]));
      const severity =
        severityRank(aToB.severity) >= severityRank(bToA.severity) ? aToB.severity : bToA.severity;
      findings.push({
        pair: [a.brandName || known[i], b.brandName || known[j]],
        severity: allEvidence.length ? severity : "informational",
        source: "openFDA",
        evidence: allEvidence.length
          ? allEvidence
          : ["No interaction text found between these medications in FDA labeling."],
        recommendation: recommendationFor(allEvidence.length ? severity : "informational"),
      });
    }
  }

  findings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  res.json({
    checkedAt: new Date().toISOString(),
    drugs: known.map((d) => {
      const l = labelMap.get(d)!;
      return {
        query: d,
        brandName: l.brandName,
        genericName: l.genericName,
        manufacturer: l.manufacturer,
        boxedWarning: l.boxedWarning?.[0] ?? null,
      };
    }),
    unknown,
    findings,
    disclaimer:
      "Informational only. Sourced from FDA openFDA drug labels. This is not medical advice. Always confirm with your pharmacist or prescriber before changing any medication.",
  });
});

export default router;
