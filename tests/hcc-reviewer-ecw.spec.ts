import { describe, expect, it } from "vitest";
import {
  buildTemplateWorklist,
  reviewHccOpportunities,
} from "../server/services/risk-adjustment/hcc-ai-reviewer";
import { SUSPECT_RULES } from "../server/services/risk-adjustment/suspect-rules";
import type { SuspectHit } from "../server/services/risk-adjustment/suspect-rules";
import type { RecaptureGap } from "../server/services/risk-adjustment/documentation-gaps";
import {
  ECW_RATE_LIMIT_PER_MINUTE,
  ECW_SANDBOX_PRACTICE_CODE,
  EcwConfigurationError,
  backendServicesAssertionClaims,
  buildBackendServicesTokenBody,
  buildEcwBaseUrl,
  describeEcwIntegration,
  discoverEcwSmartConfiguration,
  resolveEcwTarget,
} from "../server/services/ehr/ecw-client";

function ruleById(id: string) {
  const rule = SUSPECT_RULES.find((r) => r.id === id);
  if (!rule) throw new Error(`fixture references unknown rule ${id}`);
  return rule;
}

const strongHit: SuspectHit = {
  rule: ruleById("chronic-respiratory-failure-home-o2"),
  evidence: [{ finding: "Home oxygen therapy on file", sourceType: "problem-list" }],
};

const moderateHit: SuspectHit = {
  rule: ruleById("major-depression-from-phq9"),
  evidence: [{ finding: "PHQ-9 score 18", sourceType: "lab", observedAt: "2026-03-04" }],
};

const recapture: RecaptureGap = {
  icd10: "N18.32",
  name: "CKD stage 3b",
  lastCodedYear: 2025,
  reason: "chronic-condition-not-recaptured-this-year",
  action: "Re-assess and document current status.",
};

/** Build a Response-alike carrying a chat-completions payload. */
function chatResponse(content: string, ok = true): Response {
  return {
    ok,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as unknown as Response;
}

describe("deterministic worklist", () => {
  it("puts strong suspects and recapture gaps ahead of moderate ones", () => {
    const items = buildTemplateWorklist([moderateHit, strongHit], [recapture]);
    expect(items[items.length - 1].condition).toBe(moderateHit.rule.condition);
    expect(items.slice(0, 2).every((i) => i.priority === 1)).toBe(true);
  });

  it("carries the evidence and the confirmation requirement onto every item", () => {
    const items = buildTemplateWorklist([strongHit], []);
    expect(items[0].evidence).toContain("Home oxygen therapy on file");
    expect(items[0].requiresConfirmation).toBeTruthy();
    expect(items[0].aiGenerated).toBe(false);
  });

  it("dates evidence when the observation carries a date", () => {
    const items = buildTemplateWorklist([moderateHit], []);
    expect(items[0].evidence[0]).toContain("2026-03-04");
  });
});

describe("AI review", () => {
  it("returns the deterministic list unchanged when AI is unconfigured", async () => {
    const result = await reviewHccOpportunities([strongHit], [recapture], {
      aiConfigured: false,
    });
    expect(result.aiGenerated).toBe(false);
    expect(result.items).toHaveLength(2);
    expect(result.disclaimer).toContain("requires a clinician");
  });

  it("applies model-supplied priority and draft documentation", async () => {
    const result = await reviewHccOpportunities([strongHit], [], {
      aiConfigured: true,
      chatFetch: async () =>
        chatResponse(
          JSON.stringify({
            items: [
              {
                id: "chronic-respiratory-failure-home-o2",
                priority: 2,
                suggestedDocumentation: "Chronic hypoxemic respiratory failure, on 2L home O2.",
              },
            ],
          }),
        ),
    });
    expect(result.aiGenerated).toBe(true);
    expect(result.items[0].priority).toBe(2);
    expect(result.items[0].suggestedDocumentation).toContain("home O2");
  });

  it("DROPS any condition the model invents that was not a candidate", async () => {
    const result = await reviewHccOpportunities([strongHit], [], {
      aiConfigured: true,
      chatFetch: async () =>
        chatResponse(
          JSON.stringify({
            items: [
              { id: "chronic-respiratory-failure-home-o2", priority: 1 },
              {
                id: "metastatic-cancer-invented-by-model",
                priority: 1,
                suggestedDocumentation: "Metastatic carcinoma, code C79.9.",
              },
            ],
          }),
        ),
    });
    // The invented item must not survive into the clinician's worklist.
    expect(result.items).toHaveLength(1);
    expect(result.items.map((i) => i.id)).toEqual(["chronic-respiratory-failure-home-o2"]);
    expect(JSON.stringify(result)).not.toContain("Metastatic");
  });

  it("never lets the model rewrite a candidate's ICD-10 codes", async () => {
    const before = buildTemplateWorklist([strongHit], [])[0].candidateIcd10;
    const result = await reviewHccOpportunities([strongHit], [], {
      aiConfigured: true,
      chatFetch: async () =>
        chatResponse(
          JSON.stringify({
            items: [
              {
                id: "chronic-respiratory-failure-home-o2",
                priority: 1,
                candidateIcd10: ["C79.9"],
                suggestedDocumentation: "ok",
              },
            ],
          }),
        ),
    });
    expect(result.items[0].candidateIcd10).toEqual(before);
  });

  it("clamps an out-of-range priority instead of trusting it", async () => {
    const result = await reviewHccOpportunities([strongHit], [], {
      aiConfigured: true,
      chatFetch: async () =>
        chatResponse(JSON.stringify({ items: [{ id: strongHit.rule.id, priority: 99 }] })),
    });
    expect(result.items[0].priority).toBe(5);
  });

  it("falls back to the deterministic list on malformed model output", async () => {
    const result = await reviewHccOpportunities([strongHit], [], {
      aiConfigured: true,
      chatFetch: async () => chatResponse("I'm afraid I can't do that."),
    });
    expect(result.aiGenerated).toBe(false);
    expect(result.items).toHaveLength(1);
  });

  it("falls back when the chat call throws", async () => {
    const result = await reviewHccOpportunities([strongHit], [], {
      aiConfigured: true,
      chatFetch: async () => {
        throw new Error("Vertex unavailable");
      },
    });
    expect(result.aiGenerated).toBe(false);
    expect(result.items).toHaveLength(1);
  });

  it("skips the model entirely when there are no candidates", async () => {
    let called = false;
    const result = await reviewHccOpportunities([], [], {
      aiConfigured: true,
      chatFetch: async () => {
        called = true;
        return chatResponse("{}");
      },
    });
    expect(called).toBe(false);
    expect(result.items).toEqual([]);
  });
});

describe("eCW base URL", () => {
  it("builds a per-practice base URL", () => {
    expect(buildEcwBaseUrl({ practiceCode: "ABC123" })).toBe(
      "https://fhir4.eclinicalworks.com/fhir/r4/ABC123",
    );
  });

  it("honours a non-default host without doubling slashes", () => {
    expect(
      buildEcwBaseUrl({ practiceCode: "ABC123", host: "https://fhir9.eclinicalworks.com/" }),
    ).toBe("https://fhir9.eclinicalworks.com/fhir/r4/ABC123");
  });

  it("refuses an empty practice code rather than emitting a truncated URL", () => {
    expect(() => buildEcwBaseUrl({ practiceCode: "" })).toThrow(EcwConfigurationError);
    expect(() => buildEcwBaseUrl({ practiceCode: "   " })).toThrow(/practice code is required/);
  });

  it("refuses a malformed practice code", () => {
    expect(() => buildEcwBaseUrl({ practiceCode: "../../etc" })).toThrow(/well-formed/);
    expect(() => buildEcwBaseUrl({ practiceCode: "ab" })).toThrow(/well-formed/);
  });
});

describe("eCW target resolution", () => {
  it("falls back to the sandbox practice code in sandbox mode", () => {
    expect(resolveEcwTarget("sandbox", {} as NodeJS.ProcessEnv).practiceCode).toBe(
      ECW_SANDBOX_PRACTICE_CODE,
    );
  });

  it("REFUSES to fall back to the sandbox code in live mode", () => {
    expect(() => resolveEcwTarget("live", {} as NodeJS.ProcessEnv)).toThrow(
      /ECW_PRACTICE_CODE is not set/,
    );
  });

  it("uses the configured code in live mode", () => {
    const target = resolveEcwTarget("live", {
      ECW_PRACTICE_CODE: "REALPRAC",
    } as NodeJS.ProcessEnv);
    expect(target.practiceCode).toBe("REALPRAC");
  });
});

describe("eCW SMART discovery", () => {
  it("parses authorization and token endpoints from the discovery document", async () => {
    const config = await discoverEcwSmartConfiguration(
      { practiceCode: "ABC123" },
      (async (url: string) => {
        expect(url).toBe(
          "https://fhir4.eclinicalworks.com/fhir/r4/ABC123/.well-known/smart-configuration",
        );
        return {
          ok: true,
          json: async () => ({
            authorization_endpoint: "https://oauthserver.eclinicalworks.com/oauth/oauth2/authorize",
            token_endpoint: "https://oauthserver.eclinicalworks.com/oauth/oauth2/token",
            grant_types_supported: ["authorization_code", "client_credentials"],
            code_challenge_methods_supported: ["S256"],
            capabilities: ["launch-standalone", "client-confidential-asymmetric"],
          }),
        } as unknown as Response;
      }) as unknown as typeof fetch,
    );
    expect(config.tokenEndpoint).toContain("/oauth/oauth2/token");
    expect(config.supportsBackendServices).toBe(true);
    expect(config.codeChallengeMethodsSupported).toContain("S256");
  });

  it("throws when the discovery document lacks a token endpoint", async () => {
    await expect(
      discoverEcwSmartConfiguration(
        { practiceCode: "ABC123" },
        (async () =>
          ({
            ok: true,
            json: async () => ({ authorization_endpoint: "https://x/authorize" }),
          }) as unknown as Response) as unknown as typeof fetch,
      ),
    ).rejects.toThrow(/missing authorization_endpoint or token_endpoint/);
  });

  it("reports the practice-code directory when discovery 404s", async () => {
    await expect(
      discoverEcwSmartConfiguration(
        { practiceCode: "ABC123" },
        (async () => ({ ok: false, status: 404 }) as unknown as Response) as unknown as typeof fetch,
      ),
    ).rejects.toThrow(/fhirEndpoints\.jsp/);
  });
});

describe("eCW backend services", () => {
  it("builds a client-credentials body with a JWT client assertion", () => {
    const body = buildBackendServicesTokenBody({
      signedClientAssertion: "signed.jwt.value",
      scope: "system/Patient.read",
    });
    expect(body.get("grant_type")).toBe("client_credentials");
    expect(body.get("client_assertion_type")).toBe(
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    );
    expect(body.get("client_assertion")).toBe("signed.jwt.value");
  });

  it("audiences the assertion to the token endpoint", () => {
    const claims = backendServicesAssertionClaims({
      clientId: "my-client",
      tokenEndpoint: "https://oauthserver.eclinicalworks.com/oauth/oauth2/token",
      issuedAt: 1_700_000_000,
      jti: "abc",
    });
    expect(claims.aud).toBe("https://oauthserver.eclinicalworks.com/oauth/oauth2/token");
    expect(claims.iss).toBe("my-client");
    expect(claims.sub).toBe("my-client");
  });

  it("caps the assertion lifetime at the spec's five minutes", () => {
    const claims = backendServicesAssertionClaims({
      clientId: "c",
      tokenEndpoint: "https://t",
      issuedAt: 1000,
      jti: "j",
      lifetimeSeconds: 86_400,
    });
    expect(claims.exp).toBe(1300);
  });
});

describe("eCW integration status", () => {
  it("warns loudly when running on the sandbox practice code", () => {
    const status = describeEcwIntegration("sandbox", {
      ECW_CLIENT_ID: "abc",
    } as NodeJS.ProcessEnv);
    expect(status.practiceCodeSource).toBe("sandbox-default");
    expect(status.notes.some((n) => n.includes("sandbox patients"))).toBe(true);
    expect(status.rateLimitPerMinute).toBe(ECW_RATE_LIMIT_PER_MINUTE);
  });

  it("reports unconfigured, with the reason, when live has no practice code", () => {
    const status = describeEcwIntegration("live", {
      ECW_CLIENT_ID: "abc",
    } as NodeJS.ProcessEnv);
    expect(status.configured).toBe(false);
    expect(status.fhirBaseUrl).toBeNull();
    expect(status.notes.some((n) => n.includes("ECW_PRACTICE_CODE"))).toBe(true);
  });

  it("reports configured when both the code and the client id are present", () => {
    const status = describeEcwIntegration("live", {
      ECW_CLIENT_ID: "abc",
      ECW_PRACTICE_CODE: "REALPRAC",
    } as NodeJS.ProcessEnv);
    expect(status.configured).toBe(true);
    expect(status.fhirBaseUrl).toBe("https://fhir4.eclinicalworks.com/fhir/r4/REALPRAC");
  });

  it("never leaks a secret into the status payload", () => {
    const status = describeEcwIntegration("live", {
      ECW_CLIENT_ID: "abc",
      ECW_CLIENT_SECRET: "super-secret-value",
      ECW_PRACTICE_CODE: "REALPRAC",
    } as NodeJS.ProcessEnv);
    expect(JSON.stringify(status)).not.toContain("super-secret-value");
  });
});
