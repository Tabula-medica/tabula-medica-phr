import { describe, it, expect } from "vitest";
import {
  buildZipNeighborhood,
  normalizeZip,
  proximityLabel,
  scfPrefix,
  zipProximityScore,
} from "../server/services/provider-directory/zip-proximity";
import {
  getSpecialty,
  listSpecialties,
  resolveSpecialty,
} from "../server/services/provider-directory/specialty-taxonomy";
import { searchProviders } from "../server/services/provider-directory/nppes-client";
import {
  buildConfirmationPrompt,
  buildVoicePickList,
  interpretConfirmation,
  interpretVoiceSelection,
  VOICE_PAGE_SIZE,
} from "../server/services/provider-directory/voice-picklist";

// ── ZIP proximity ───────────────────────────────────────────────────────────

describe("normalizeZip", () => {
  it("accepts ZIP-5 and ZIP+4", () => {
    expect(normalizeZip("94110")).toBe("94110");
    expect(normalizeZip("94110-1234")).toBe("94110");
    expect(normalizeZip("  94110 ")).toBe("94110");
  });

  it("rejects a 4-digit typo instead of silently searching elsewhere", () => {
    expect(normalizeZip("9411")).toBeNull();
    expect(normalizeZip("941101")).toBeNull();
    expect(normalizeZip("abcde")).toBeNull();
    expect(normalizeZip("")).toBeNull();
  });

  it("preserves a leading zero", () => {
    expect(normalizeZip("02134")).toBe("02134");
    expect(scfPrefix("02134")).toBe("021");
  });
});

describe("buildZipNeighborhood", () => {
  it("puts the seed's own SCF first", () => {
    const n = buildZipNeighborhood("94110", 1)!;
    expect(n.scf).toBe("941");
    expect(n.scfRings[0]).toBe("941");
    expect(n.scfRings).toContain("940");
    expect(n.scfRings).toContain("942");
  });

  it("expands further with more rings", () => {
    const one = buildZipNeighborhood("94110", 1)!;
    const two = buildZipNeighborhood("94110", 2)!;
    expect(two.scfRings.length).toBeGreaterThan(one.scfRings.length);
    expect(two.scfRings).toContain("939");
    expect(two.scfRings).toContain("943");
  });

  it("returns only the seed SCF with zero rings", () => {
    expect(buildZipNeighborhood("94110", 0)!.scfRings).toEqual(["941"]);
  });

  it("does not wrap past the ends of the range", () => {
    // 000 and 999 are not neighbours; wrapping would jump across the country.
    expect(buildZipNeighborhood("00501", 1)!.scfRings).not.toContain("999");
    expect(buildZipNeighborhood("99950", 1)!.scfRings).not.toContain("000");
  });

  it("pads SCF prefixes back to three digits", () => {
    expect(buildZipNeighborhood("01001", 1)!.scfRings).toContain("009");
  });

  it("returns null for an invalid ZIP", () => {
    expect(buildZipNeighborhood("bad", 1)).toBeNull();
  });
});

describe("zipProximityScore", () => {
  it("scores the same ZIP as zero", () => {
    expect(zipProximityScore("94110", "94110")).toBe(0);
  });

  it("scores within an SCF by numeric gap", () => {
    expect(zipProximityScore("94110", "94112")).toBe(2);
    expect(zipProximityScore("94110", "94131")).toBe(21);
  });

  it("sorts every same-SCF result ahead of any different-SCF result", () => {
    const farWithinScf = zipProximityScore("94110", "94199");
    const nearestOtherScf = zipProximityScore("94110", "94210");
    expect(farWithinScf).toBeLessThan(nearestOtherScf);
  });

  it("sorts unparseable ZIPs last rather than first", () => {
    expect(zipProximityScore("94110", "")).toBe(Infinity);
    expect(zipProximityScore("94110", "oops")).toBe(Infinity);
  });
});

describe("proximityLabel", () => {
  it("describes proximity in words, never in miles", () => {
    expect(proximityLabel("94110", "94110")).toBe("same ZIP code");
    expect(proximityLabel("94110", "94112")).toBe("nearby ZIP code");
    expect(proximityLabel("94110", "oops")).toBe("location unknown");
    // The module cannot compute distance, so it must never imply it can.
    for (const c of ["94110", "94112", "94510", "oops"]) {
      expect(proximityLabel("94110", c)).not.toMatch(/mile|km|minute/i);
    }
  });
});

// ── Specialty resolution ────────────────────────────────────────────────────

describe("resolveSpecialty", () => {
  it("resolves lay phrases spoken as a whole utterance", () => {
    expect(resolveSpecialty("find me a heart doctor nearby")?.id).toBe("cardiology");
    expect(resolveSpecialty("I need a skin doctor")?.id).toBe("dermatology");
    expect(resolveSpecialty("arthritis specialist please")?.id).toBe("rheumatology");
    expect(resolveSpecialty("kidney doctor")?.id).toBe("nephrology");
  });

  it("resolves clinical names and abbreviations", () => {
    expect(resolveSpecialty("cardiology")?.id).toBe("cardiology");
    expect(resolveSpecialty("gi")?.id).toBe("gastroenterology");
    expect(resolveSpecialty("obgyn")?.id).toBe("obgyn");
    expect(resolveSpecialty("pcp")?.id).toBe("primary-care");
  });

  it("prefers the longest matching synonym", () => {
    expect(resolveSpecialty("orthopedic surgeon")?.id).toBe("orthopedics");
  });

  it("returns null rather than guessing a specialty", () => {
    // Guessing sends the patient's referral to the wrong kind of clinic.
    expect(resolveSpecialty("banana")).toBeNull();
    expect(resolveSpecialty("")).toBeNull();
  });

  it("gives every specialty NPPES taxonomy fragments to search with", () => {
    for (const s of listSpecialties()) {
      const def = getSpecialty(s.id)!;
      expect(def.taxonomyFragments.length, s.id).toBeGreaterThan(0);
      expect(def.synonyms.length, s.id).toBeGreaterThan(0);
    }
  });
});

// ── NPPES client ────────────────────────────────────────────────────────────

function nppesRecord(npi: string, last: string, zip: string, city = "San Francisco") {
  return {
    number: npi,
    enumeration_type: "NPI-1",
    basic: { first_name: "Ada", last_name: last, credential: "MD" },
    addresses: [
      {
        address_purpose: "LOCATION",
        address_1: "1 Main St",
        city,
        state: "CA",
        postal_code: `${zip}1234`,
        telephone_number: "415-555-0100",
      },
    ],
    taxonomies: [{ desc: "Internal Medicine, Cardiovascular Disease", primary: true }],
  };
}

function fakeFetch(byPrefix: Record<string, unknown[]>, failures: string[] = []) {
  return async (url: string | URL | Request): Promise<Response> => {
    const href = typeof url === "string" ? url : url.toString();
    const prefix = new URL(href).searchParams.get("postal_code")!.replace("*", "");
    if (failures.includes(prefix)) {
      return { ok: false, status: 503, json: async () => ({}) } as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ results: byPrefix[prefix] ?? [] }),
    } as Response;
  };
}

describe("searchProviders", () => {
  it("merges results across ZIP prefixes and ranks by proximity", async () => {
    const out = await searchProviders({
      specialtyId: "cardiology",
      zip: "94110",
      rings: 1,
      fetchImpl: fakeFetch({
        "941": [nppesRecord("1111111111", "Near", "94112")],
        "940": [nppesRecord("2222222222", "Far", "94025")],
        "942": [nppesRecord("3333333333", "Alsofar", "94203")],
      }),
    });

    // 94112 shares the seed's SCF, so it ranks first. 94025 (SCF 940) and
    // 94203 (SCF 942) are each one SCF away and therefore EQUIDISTANT under
    // postal proximity — they tie, and the tie breaks by name.
    expect(out.providers[0].npi).toBe("1111111111");
    expect(out.providers[0].proximityLabel).toBe("nearby ZIP code");
    expect(out.providers[1].proximityScore).toBe(out.providers[2].proximityScore);
    expect(out.providers.slice(1).map((p) => p.name)).toEqual([
      "Ada Alsofar",
      "Ada Far",
    ]);
    expect(out.searchedPrefixes[0]).toBe("941");
  });

  it("deduplicates an NPI listed under two prefixes, keeping the nearer", async () => {
    const dup = nppesRecord("1111111111", "Dup", "94112");
    const out = await searchProviders({
      specialtyId: "cardiology",
      zip: "94110",
      rings: 1,
      fetchImpl: fakeFetch({ "941": [dup], "940": [dup], "942": [dup] }),
    });
    expect(out.providers).toHaveLength(1);
    expect(out.providers[0].proximityScore).toBe(2);
  });

  it("degrades a failed prefix to a warning instead of failing the search", async () => {
    const out = await searchProviders({
      specialtyId: "cardiology",
      zip: "94110",
      rings: 1,
      fetchImpl: fakeFetch(
        { "941": [nppesRecord("1111111111", "Ok", "94112")] },
        ["940", "942"],
      ),
    });
    expect(out.providers).toHaveLength(1);
    // Two failed prefixes, and cardiology carries two taxonomy fragments, so
    // each prefix fails once per fragment.
    expect(out.warnings.length).toBe(4);
    expect(out.warnings[0]).toContain("503");
  });

  it("queries every taxonomy fragment, not just the first", async () => {
    const asked: string[] = [];
    const out = await searchProviders({
      specialtyId: "primary-care",
      zip: "94110",
      rings: 0,
      fetchImpl: async (url) => {
        const href = typeof url === "string" ? url : url.toString();
        const taxonomy = new URL(href).searchParams.get("taxonomy_description")!;
        asked.push(taxonomy);
        // Only the second fragment has anyone in this area. Querying the first
        // fragment alone would return an empty list and look like "no primary
        // care nearby", which is the failure this guards against.
        return {
          ok: true,
          status: 200,
          json: async () => ({
            results: taxonomy.startsWith("Internal Medicine")
              ? [nppesRecord("4444444444", "Internist", "94112")]
              : [],
          }),
        } as Response;
      },
    });

    expect(asked).toEqual(["Family Medicine*", "Internal Medicine*"]);
    expect(out.providers.map((p) => p.npi)).toEqual(["4444444444"]);
  });

  it("warns when NPPES truncates at its 200-result cap", async () => {
    const many = Array.from({ length: 200 }, (_, i) =>
      nppesRecord(String(1000000000 + i), `Doc${i}`, "94112"),
    );
    const out = await searchProviders({
      specialtyId: "cardiology",
      zip: "94110",
      rings: 0,
      fetchImpl: fakeFetch({ "941": many }),
    });
    expect(out.warnings.some((w) => w.includes("200-result cap"))).toBe(true);
  });

  it("always returns the enumeration-is-not-verification disclaimer", async () => {
    const out = await searchProviders({
      specialtyId: "cardiology",
      zip: "94110",
      rings: 0,
      fetchImpl: fakeFetch({ "941": [] }),
    });
    expect(out.disclaimer).toMatch(/not current licensure/i);
  });

  it("rejects a non-US ZIP rather than searching a registry that cannot hold it", async () => {
    await expect(
      searchProviders({
        specialtyId: "cardiology",
        zip: "SW1A 1AA",
        fetchImpl: fakeFetch({}),
      }),
    ).rejects.toThrow(/not a valid 5-digit US ZIP/);
  });

  it("rejects an unknown specialty", async () => {
    await expect(
      searchProviders({ specialtyId: "astrology", zip: "94110", fetchImpl: fakeFetch({}) }),
    ).rejects.toThrow(/Unknown specialty/);
  });

  it("honours the result limit", async () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      nppesRecord(String(1000000000 + i), `Doc${i}`, "94112"),
    );
    const out = await searchProviders({
      specialtyId: "cardiology",
      zip: "94110",
      rings: 0,
      limit: 5,
      fetchImpl: fakeFetch({ "941": many }),
    });
    expect(out.providers).toHaveLength(5);
  });
});

// ── Voice pick list ─────────────────────────────────────────────────────────

async function sampleList(count = 3) {
  const out = await searchProviders({
    specialtyId: "cardiology",
    zip: "94110",
    rings: 0,
    fetchImpl: fakeFetch({
      "941": Array.from({ length: count }, (_, i) =>
        nppesRecord(String(1000000000 + i), ["Shah", "Okafor", "Nguyen", "Rossi", "Silva", "Tan"][i] ?? `Doc${i}`, "94112"),
      ),
    }),
  });
  return buildVoicePickList(out.providers, "Cardiology");
}

describe("buildVoicePickList", () => {
  it("numbers entries and reads a usable prompt", async () => {
    const list = await sampleList(3);
    expect(list.items.map((i) => i.ordinal)).toEqual([1, 2, 3]);
    expect(list.prompt).toContain("I found 3 Cardiology providers");
    expect(list.prompt).toContain("Number 1.");
    expect(list.prompt).toContain("Say the number to choose");
  });

  it("pages rather than reading a long list aloud", async () => {
    const list = await sampleList(6);
    expect(list.items).toHaveLength(VOICE_PAGE_SIZE);
    expect(list.hasMore).toBe(true);
    expect(list.totalCount).toBe(6);
    expect(list.prompt).toContain("say 'more'");
  });

  it("handles an empty result with a next step", async () => {
    const list = buildVoicePickList([], "Rheumatology");
    expect(list.items).toEqual([]);
    expect(list.prompt).toContain("could not find any Rheumatology providers");
    expect(list.prompt).toContain("widen the search");
  });

  it("uses singular wording for one result", async () => {
    const list = await sampleList(1);
    expect(list.prompt).toContain("I found 1 Cardiology provider nearby.");
    expect(list.prompt).toContain("Here is the first one.");
  });
});

describe("interpretVoiceSelection", () => {
  it("selects on a spoken ordinal", async () => {
    const list = await sampleList(3);
    for (const utterance of ["two", "number two", "I'll take 2", "the second one"]) {
      const r = interpretVoiceSelection(utterance, list);
      expect(r.status, utterance).toBe("selected");
      if (r.status === "selected") expect(r.item.ordinal).toBe(2);
    }
  });

  it("tolerates common misrecognitions of small numbers", async () => {
    const list = await sampleList(4);
    // "for"/"fore" for four, "ate" for eight, "to"/"too" for two.
    expect(interpretVoiceSelection("for", list).status).toBe("selected");
    const r = interpretVoiceSelection("too", list);
    expect(r.status).toBe("selected");
    if (r.status === "selected") expect(r.item.ordinal).toBe(2);
  });

  it("refuses instead of guessing when two numbers are heard", async () => {
    const list = await sampleList(3);
    const r = interpretVoiceSelection("two or three", list);
    expect(r.status).toBe("ambiguous");
    if (r.status === "ambiguous") expect(r.candidates).toEqual(["2", "3"]);
  });

  it("reports out-of-range without selecting anything", async () => {
    const list = await sampleList(3);
    const r = interpretVoiceSelection("number nine", list);
    expect(r.status).toBe("out-of-range");
    if (r.status === "out-of-range") expect(r.reprompt).toContain("between 1 and 3");
  });

  it("recognises control words", async () => {
    const list = await sampleList(6);
    expect(interpretVoiceSelection("more", list).status).toBe("more");
    expect(interpretVoiceSelection("say that again", list).status).toBe("repeat");
    expect(interpretVoiceSelection("cancel", list).status).toBe("cancel");
  });

  it("selects on an unambiguous surname", async () => {
    const list = await sampleList(3);
    const r = interpretVoiceSelection("doctor okafor", list);
    expect(r.status).toBe("selected");
    if (r.status === "selected") expect(r.item.provider.name).toContain("Okafor");
  });

  it("re-prompts on an unrecognised utterance rather than picking the first", async () => {
    // A mis-select sends clinical detail to the wrong practice.
    const list = await sampleList(3);
    const r = interpretVoiceSelection("the tall one near the park", list);
    expect(r.status).toBe("unrecognized");
  });

  it("does not read a number out of an ordinary sentence", async () => {
    // English homographs are the trap: "one" is a pronoun, and "to"/"for" are
    // among the commonest words in the language. Reading a selection out of
    // any of them sends a referral to a provider the user never chose.
    const list = await sampleList(4);
    for (const utterance of [
      "the tall one near the park",
      "I want to pick someone good",
      "is there one closer to my house",
      "what are they like",
    ]) {
      expect(interpretVoiceSelection(utterance, list).status, utterance).not.toBe(
        "selected",
      );
    }
  });

  it("still selects when the same words are plainly a choice", async () => {
    const list = await sampleList(4);
    for (const [utterance, ordinal] of [
      ["I want number two", 2],
      ["option three", 3],
      ["pick 4", 4],
      ["the first one", 1],
    ] as Array<[string, number]>) {
      const r = interpretVoiceSelection(utterance, list);
      expect(r.status, utterance).toBe("selected");
      if (r.status === "selected") expect(r.item.ordinal, utterance).toBe(ordinal);
    }
  });

  it("re-prompts on empty input", async () => {
    const list = await sampleList(3);
    expect(interpretVoiceSelection("", list).status).toBe("unrecognized");
  });
});

describe("confirmation", () => {
  it("reads the address back before anything irreversible", async () => {
    const list = await sampleList(2);
    const prompt = buildConfirmationPrompt(list.items[0]);
    expect(prompt).toContain("You chose");
    expect(prompt).toContain("1 Main St");
    expect(prompt).toContain("Say 'yes'");
  });

  it("interprets yes and no, and refuses anything else", () => {
    expect(interpretConfirmation("yes")).toBe(true);
    expect(interpretConfirmation("yep that's correct")).toBe(true);
    expect(interpretConfirmation("no")).toBe(false);
    expect(interpretConfirmation("wrong one")).toBe(false);
    expect(interpretConfirmation("maybe")).toBeNull();
    expect(interpretConfirmation("")).toBeNull();
  });
});

// ── Referral composition ────────────────────────────────────────────────────

import {
  buildTemplateReferral,
  composeReferral,
  type ReferralRequest,
} from "../server/services/provider-directory/referral-composer";

function referralRequest(): ReferralRequest {
  return {
    patient: {
      name: "Asha Mehta",
      age: 52,
      dateOfBirth: "1974-03-02",
      gender: "female",
      conditions: ["Type 2 diabetes mellitus", "Essential hypertension"],
      medications: ["Metformin 500mg BD", "Lisinopril 10mg OD"],
      allergies: ["Penicillin"],
    },
    provider: {
      npi: "1111111111",
      name: "Ada Okafor",
      kind: "individual",
      credential: "MD",
      specialty: "Internal Medicine, Cardiovascular Disease",
      address: {
        line1: "1 Main St",
        city: "San Francisco",
        state: "CA",
        zip: "94112",
      },
      proximityScore: 2,
      proximityLabel: "nearby ZIP code",
    },
    reason: "Exertional chest pain for evaluation",
    urgency: "routine",
    referringClinician: "Dr R Kumar",
    referringClinic: "Bay Family Medicine",
  };
}

describe("buildTemplateReferral", () => {
  it("addresses the letter to the selected NPI", () => {
    const text = buildTemplateReferral(referralRequest());
    expect(text).toContain("NPI: 1111111111");
    expect(text).toContain("Ada Okafor, MD");
    expect(text).toContain("1 Main St");
  });

  it("includes the clinical context", () => {
    const text = buildTemplateReferral(referralRequest());
    expect(text).toContain("Type 2 diabetes mellitus");
    expect(text).toContain("Metformin 500mg BD");
    expect(text).toContain("Penicillin");
    expect(text).toContain("Exertional chest pain");
  });

  it("states no known drug allergies rather than leaving it blank", () => {
    // A blank allergy field reads as "not asked"; the explicit statement is
    // the same distinction the IPS absent-unknown codes exist for.
    const req = referralRequest();
    req.patient.allergies = [];
    expect(buildTemplateReferral(req)).toContain("No known drug allergies");
  });

  it("omits empty sections instead of padding with 'none documented'", () => {
    const req = referralRequest();
    req.patient.medications = [];
    expect(buildTemplateReferral(req)).not.toContain("Current medications");
  });
});

describe("composeReferral", () => {
  it("uses the template and flags it when AI is not configured", async () => {
    const draft = await composeReferral(referralRequest(), {
      aiConfigured: () => false,
      chatFetch: async () => {
        throw new Error("must not be called");
      },
    });
    expect(draft.aiGenerated).toBe(false);
    expect(draft.letterContent).toContain("NPI: 1111111111");
    expect(draft.addressedToNpi).toBe("1111111111");
  });

  it("uses the AI text when the BAA-routed call succeeds", async () => {
    const draft = await composeReferral(referralRequest(), {
      aiConfigured: () => true,
      chatFetch: async () =>
        ({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: "Generated referral body." } }],
          }),
        }) as Response,
    });
    expect(draft.aiGenerated).toBe(true);
    expect(draft.letterContent).toBe("Generated referral body.");
  });

  it("falls back to the template when the model call throws", async () => {
    // A referral workflow must not break because a model endpoint is down.
    const draft = await composeReferral(referralRequest(), {
      aiConfigured: () => true,
      chatFetch: async () => {
        throw new Error("vertex unavailable");
      },
    });
    expect(draft.aiGenerated).toBe(false);
    expect(draft.letterContent).toContain("Dear Colleague");
  });

  it("falls back when the model returns a non-ok response", async () => {
    const draft = await composeReferral(referralRequest(), {
      aiConfigured: () => true,
      chatFetch: async () => ({ ok: false, json: async () => ({}) }) as Response,
    });
    expect(draft.aiGenerated).toBe(false);
  });

  it("falls back when the model returns empty content", async () => {
    const draft = await composeReferral(referralRequest(), {
      aiConfigured: () => true,
      chatFetch: async () =>
        ({ ok: true, json: async () => ({ choices: [{ message: { content: "  " } }] }) }) as Response,
    });
    expect(draft.aiGenerated).toBe(false);
  });

  it("always carries the enumeration-is-not-verification disclaimer", async () => {
    const draft = await composeReferral(referralRequest(), {
      aiConfigured: () => false,
    });
    expect(draft.disclaimer).toMatch(/confirm enrolment only/i);
    expect(draft.status).toBe("draft");
  });

  it("sends PHI only through the injected BAA-routed helper", async () => {
    // Guards the rule that new PHI paths do not reach a non-BAA endpoint.
    let sawPhi = false;
    await composeReferral(referralRequest(), {
      aiConfigured: () => true,
      chatFetch: async (opts) => {
        sawPhi = JSON.stringify(opts?.body ?? {}).includes("Asha Mehta");
        return { ok: true, json: async () => ({ choices: [] }) } as Response;
      },
    });
    expect(sawPhi).toBe(true);
  });
});
