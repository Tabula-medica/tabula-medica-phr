import { Router, Request, Response } from "express";

const router = Router();

interface NPISearchParams {
  q?: string;
  npi?: string;
  type?: "individual" | "organization";
  state?: string;
  specialty?: string;
  city?: string;
  limit?: number;
}

router.get("/search", async (req: Request, res: Response) => {
  try {
    const { q, npi, type, state, specialty, city, limit } = req.query as Record<string, string>;

    const params = new URLSearchParams();
    params.set("version", "2.1");
    params.set("limit", limit || "20");

    if (npi) {
      params.set("number", npi);
    } else if (q) {
      const trimmed = q.trim();
      const enumType = type === "organization" ? "NPI-2" : type === "individual" ? "NPI-1" : "";

      if (enumType) {
        params.set("enumeration_type", enumType);
      }

      if (type === "organization" || /\b(health|hospital|medical|clinic|center|group|associates|system)\b/i.test(trimmed)) {
        params.set("organization_name", trimmed.replace(/[*]/g, "").trim() + "*");
        if (!enumType) params.set("enumeration_type", "NPI-2");
      } else {
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 2) {
          params.set("first_name", parts[0] + "*");
          params.set("last_name", parts.slice(1).join(" ") + "*");
        } else {
          params.set("last_name", trimmed + "*");
        }
        if (!enumType) params.set("enumeration_type", "NPI-1");
      }

      if (state) params.set("state", state.toUpperCase());
      if (city) params.set("city", city);

      if (specialty) {
        params.set("taxonomy_description", specialty + "*");
      }
    } else {
      return res.json({ results: [], count: 0 });
    }

    const url = `https://npiregistry.cms.hhs.gov/api/?${params.toString()}`;
    const response = await fetch(url);
    const data = await response.json();

    const results = (data.results || []).map((r: any) => {
      const basic = r.basic || {};
      const addr = r.addresses?.find((a: any) => a.address_purpose === "LOCATION") || r.addresses?.[0] || {};
      const taxonomies = r.taxonomies || [];
      const primaryTaxonomy = taxonomies.find((t: any) => t.primary) || taxonomies[0] || {};

      const isOrg = r.enumeration_type === "NPI-2";
      const displayName = isOrg
        ? basic.organization_name || ""
        : `${basic.first_name || ""} ${basic.last_name || ""}`.trim();

      return {
        npi: r.number?.toString() || "",
        displayName,
        type: isOrg ? "organization" : "individual",
        credential: basic.credential || "",
        gender: basic.gender || "",
        status: basic.status === "A" ? "active" : basic.status || "unknown",
        lastUpdated: basic.last_updated || "",
        enumerationDate: basic.enumeration_date || "",
        specialty: primaryTaxonomy.desc || "",
        taxonomyCode: primaryTaxonomy.code || "",
        taxonomyLicense: primaryTaxonomy.license || "",
        allSpecialties: taxonomies.map((t: any) => ({
          code: t.code,
          description: t.desc,
          primary: t.primary,
          state: t.state,
          license: t.license,
        })),
        address: {
          line1: addr.address_1 || "",
          line2: addr.address_2 || "",
          city: addr.city || "",
          state: addr.state || "",
          zip: addr.postal_code || "",
          country: addr.country_name || "US",
          phone: addr.telephone_number || "",
          fax: addr.fax_number || "",
        },
        organization: isOrg ? "" : (basic.organization_name || addr.organization_name || ""),
        otherNames: (r.other_names || []).map((n: any) => ({
          type: n.type,
          name: isOrg ? n.organization_name : `${n.first_name || ""} ${n.last_name || ""}`.trim(),
        })),
      };
    });

    res.json({
      results,
      count: data.result_count || results.length,
      query: q || npi || "",
    });
  } catch (err: any) {
    console.error("[NPI Lookup] Error:", err.message);
    res.status(500).json({ error: "Failed to query NPI Registry", details: err.message });
  }
});

router.get("/lookup/:npi", async (req: Request, res: Response) => {
  try {
    const { npi } = req.params;

    if (!/^\d{10}$/.test(npi)) {
      return res.status(400).json({ error: "Invalid NPI number. Must be 10 digits." });
    }

    const url = `https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return res.status(404).json({ error: "NPI not found in the CMS registry." });
    }

    const r = data.results[0];
    const basic = r.basic || {};
    const locationAddr = r.addresses?.find((a: any) => a.address_purpose === "LOCATION") || {};
    const mailingAddr = r.addresses?.find((a: any) => a.address_purpose === "MAILING") || {};
    const taxonomies = r.taxonomies || [];
    const isOrg = r.enumeration_type === "NPI-2";

    res.json({
      npi: r.number?.toString(),
      type: isOrg ? "organization" : "individual",
      displayName: isOrg
        ? basic.organization_name || ""
        : `${basic.first_name || ""} ${basic.last_name || ""}`.trim(),
      credential: basic.credential || "",
      gender: basic.gender || "",
      status: basic.status === "A" ? "active" : basic.status || "unknown",
      lastUpdated: basic.last_updated || "",
      enumerationDate: basic.enumeration_date || "",
      soleProprieter: basic.sole_proprietor || "",
      organization: basic.organization_name || "",
      specialties: taxonomies.map((t: any) => ({
        code: t.code,
        description: t.desc,
        primary: t.primary,
        state: t.state,
        license: t.license,
      })),
      locationAddress: {
        line1: locationAddr.address_1 || "",
        line2: locationAddr.address_2 || "",
        city: locationAddr.city || "",
        state: locationAddr.state || "",
        zip: locationAddr.postal_code || "",
        phone: locationAddr.telephone_number || "",
        fax: locationAddr.fax_number || "",
      },
      mailingAddress: {
        line1: mailingAddr.address_1 || "",
        line2: mailingAddr.address_2 || "",
        city: mailingAddr.city || "",
        state: mailingAddr.state || "",
        zip: mailingAddr.postal_code || "",
        phone: mailingAddr.telephone_number || "",
        fax: mailingAddr.fax_number || "",
      },
      otherNames: (r.other_names || []).map((n: any) => ({
        type: n.type,
        name: isOrg ? n.organization_name : `${n.first_name || ""} ${n.last_name || ""}`.trim(),
      })),
    });
  } catch (err: any) {
    console.error("[NPI Lookup] Error:", err.message);
    res.status(500).json({ error: "Failed to lookup NPI", details: err.message });
  }
});

export default router;
