import type { Express, Request, Response } from "express";
import { requireAuth } from "./middleware/require-auth";

// requireAuth previously had a header-only local implementation. Replaced
// 2026-05-18 with the canonical Bearer-token middleware per audit finding M-3.

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function getCached(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

const PREFERRED_TTY = new Set(["SCD", "SBD", "GPCK", "BPCK"]);

export function registerClinicalCodeLookupRoutes(app: Express) {
  app.get("/api/clinical-codes/rxnorm/search", requireAuth, async (req: Request, res: Response) => {
    try {
      const term = (req.query.term as string) || "";
      const maxResults = parseInt((req.query.maxResults as string) || "10", 10);
      if (!term) return res.status(400).json({ error: "term parameter is required" });

      const cacheKey = `rxnorm:search:${term}:${maxResults}`;
      const cached = getCached(cacheKey);
      if (cached) return res.json(cached);

      const url = `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(term)}`;
      const response = await fetch(url);
      if (!response.ok) return res.status(502).json({ error: "Failed to fetch from RxNorm API" });

      const data = await response.json();
      const results: { code: string; display: string; system: string; tty: string }[] = [];
      const conceptGroups = data?.drugGroup?.conceptGroup || [];

      for (const group of conceptGroups) {
        if (!group.conceptProperties) continue;
        for (const prop of group.conceptProperties) {
          results.push({
            code: prop.rxcui,
            display: prop.name || prop.synonym || "",
            system: "http://www.nlm.nih.gov/research/umls/rxnorm",
            tty: prop.tty || group.tty || "",
          });
        }
      }

      const preferred = results.filter(r => PREFERRED_TTY.has(r.tty));
      const sorted = preferred.length > 0 ? [...preferred, ...results.filter(r => !PREFERRED_TTY.has(r.tty))] : results;
      const limited = sorted.slice(0, maxResults);

      const result = { results: limited };
      setCache(cacheKey, result);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/clinical-codes/rxnorm/approximate", requireAuth, async (req: Request, res: Response) => {
    try {
      const term = (req.query.term as string) || "";
      const maxResults = parseInt((req.query.maxResults as string) || "10", 10);
      if (!term) return res.status(400).json({ error: "term parameter is required" });

      const cacheKey = `rxnorm:approximate:${term}:${maxResults}`;
      const cached = getCached(cacheKey);
      if (cached) return res.json(cached);

      const url = `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(term)}&maxEntries=${maxResults}`;
      const response = await fetch(url);
      if (!response.ok) return res.status(502).json({ error: "Failed to fetch from RxNorm API" });

      const data = await response.json();
      const candidates = data?.approximateGroup?.candidate || [];
      const results = candidates.map((c: any) => ({
        code: c.rxcui,
        display: c.name || "",
        system: "http://www.nlm.nih.gov/research/umls/rxnorm",
        score: typeof c.score === "number" ? c.score : parseInt(c.score || "0", 10),
      }));

      const result = { results: results.slice(0, maxResults) };
      setCache(cacheKey, result);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/clinical-codes/loinc/search", requireAuth, async (req: Request, res: Response) => {
    try {
      const term = (req.query.term as string) || "";
      const maxResults = parseInt((req.query.maxResults as string) || "10", 10);
      if (!term) return res.status(400).json({ error: "term parameter is required" });

      const cacheKey = `loinc:search:${term}:${maxResults}`;
      const cached = getCached(cacheKey);
      if (cached) return res.json(cached);

      const url = `https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search?terms=${encodeURIComponent(term)}&maxList=${maxResults}&df=LOINC_NUM,LONG_COMMON_NAME,COMPONENT,SYSTEM,CLASS`;
      const response = await fetch(url);
      if (!response.ok) return res.status(502).json({ error: "Failed to fetch from LOINC API" });

      const data = await response.json();
      const displayFields = data[3] || [];
      const results = displayFields.map((fields: string[]) => ({
        code: fields[0] || "",
        display: fields[1] || "",
        system: "http://loinc.org",
        component: fields[2] || "",
        bodySite: fields[3] || "",
        category: fields[4] || "",
      }));

      const result = { results: results.slice(0, maxResults) };
      setCache(cacheKey, result);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/clinical-codes/npi/search", requireAuth, async (req: Request, res: Response) => {
    try {
      const name = (req.query.name as string) || "";
      let firstName = (req.query.firstName as string) || "";
      let lastName = (req.query.lastName as string) || "";
      const state = (req.query.state as string) || "";
      const taxonomy = (req.query.taxonomy as string) || "";
      const maxResults = parseInt((req.query.maxResults as string) || "10", 10);

      if (name && !firstName && !lastName) {
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
          firstName = parts[0];
          lastName = parts.slice(1).join(" ");
        } else {
          lastName = parts[0];
        }
      }

      if (!firstName && !lastName) return res.status(400).json({ error: "name, firstName, or lastName parameter is required" });

      const cacheKey = `npi:search:${firstName}:${lastName}:${state}:${taxonomy}:${maxResults}`;
      const cached = getCached(cacheKey);
      if (cached) return res.json(cached);

      const params = new URLSearchParams({ version: "2.1", enumeration_type: "NPI-1", limit: String(maxResults) });
      if (firstName) params.set("first_name", firstName);
      if (lastName) params.set("last_name", lastName);
      if (state) params.set("state", state);
      if (taxonomy) params.set("taxonomy_description", taxonomy);

      const url = `https://npiregistry.cms.hhs.gov/api/?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) return res.status(502).json({ error: "Failed to fetch from NPI Registry API" });

      const data = await response.json();
      const npiResults = data?.results || [];
      const results = npiResults.map((r: any) => {
        const basic = r.basic || {};
        const address = (r.addresses || [])[0] || {};
        const taxonomyEntry = (r.taxonomies || [])[0] || {};
        return {
          npi: r.number || "",
          firstName: basic.first_name || "",
          lastName: basic.last_name || "",
          credential: basic.credential || "",
          specialty: taxonomyEntry.desc || "",
          city: address.city || "",
          state: address.state || "",
          phone: address.telephone_number || "",
        };
      });

      const result = { results };
      setCache(cacheKey, result);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });
}

export default registerClinicalCodeLookupRoutes;
