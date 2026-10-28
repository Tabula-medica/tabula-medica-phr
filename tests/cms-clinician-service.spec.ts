import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  buildProfile, cmsQueryUrl, getCmsClinicianProfile, clearCmsCache,
} from "../server/services/cms-clinician-service";

// Real rows returned by data.cms.gov for NPI 1003000126 (Oct 2026), trimmed.
const CLIN = [{
  npi: "1003000126", ind_enrl_id: "I20130530000085", cred: "MD", med_sch: "OTHER", grd_yr: "1994",
  pri_spec: "HOSPITALIST", sec_spec_all: "INTERNAL MEDICINE", telehlth: "",
  facility_name: "MEDICAL FACULTY ASSOCIATES, INC", org_pac_id: "4082528898", num_org_mem: "672",
  adr_ln_1: "1200 PECAN ST SE", adr_ln_2: "", citytown: "WASHINGTON", state: "DC", zip_code: "200322652",
  telephone_number: "7714446200", ind_assgn: "Y", adrs_id: "DC200322652WA1200XSEXX400",
}];
const AFF = [{ npi: "1003000126", facility_type: "Hospital", facility_affiliations_certification_number: "090012" }];

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as unknown as Response;

describe("cms-clinician-service", () => {
  beforeEach(() => clearCmsCache());

  it("builds an NPI equality query against the CMS datastore", () => {
    const u = new URL(cmsQueryUrl("mj5m-pzi6", "npi", "1003000126"));
    expect(u.pathname).toContain("/datastore/query/mj5m-pzi6/0");
    expect(u.searchParams.get("conditions[0][property]")).toBe("npi");
    expect(u.searchParams.get("conditions[0][value]")).toBe("1003000126");
    expect(u.searchParams.get("conditions[0][operator]")).toBe("=");
  });

  it("maps CMS rows to a profile", () => {
    const p = buildProfile("1003000126", CLIN, AFF);
    expect(p.medicareEnrolled).toBe(true);
    expect(p.graduationYear).toBe(1994);
    expect(p.medicalSchool).toBeNull(); // CMS "OTHER" is hidden
    expect(p.primarySpecialty).toBe("HOSPITALIST");
    expect(p.secondarySpecialties).toEqual(["INTERNAL MEDICINE"]);
    expect(p.telehealth).toBeNull();
    expect(p.locations[0]).toMatchObject({ facilityName: "MEDICAL FACULTY ASSOCIATES, INC", zip: "20032", acceptsMedicareAssignment: true, groupMemberCount: 672 });
    expect(p.affiliations).toEqual([{ facilityType: "Hospital", ccn: "090012", name: null, city: null, state: null }]);
  });

  it("reports not enrolled when CMS has no rows", () => {
    const p = buildProfile("1234567893", [], []);
    expect(p.available).toBe(true);
    expect(p.medicareEnrolled).toBe(false);
  });

  it("names affiliated hospitals and sends a browser User-Agent", async () => {
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)["User-Agent"]).toMatch(/Mozilla/);
      if (url.includes("mj5m-pzi6")) return json({ results: CLIN });
      if (url.includes("27ea-46a8")) return json({ results: AFF });
      return json({ results: [{ facility_id: "090012", facility_name: "TEST HOSPITAL", citytown: "WASHINGTON", state: "DC" }] });
    });
    const p = await getCmsClinicianProfile("1003000126", f as unknown as typeof fetch);
    expect(p.affiliations[0].name).toBe("TEST HOSPITAL");
    await getCmsClinicianProfile("1003000126", f as unknown as typeof fetch);
    expect(f).toHaveBeenCalledTimes(3); // second call served from cache
  });

  it("falls back gracefully when CMS is down", async () => {
    const f = vi.fn(async () => json({}, 403));
    const p = await getCmsClinicianProfile("1003000126", f as unknown as typeof fetch);
    expect(p.available).toBe(false);
    expect(p.locations).toEqual([]);
  });
});
