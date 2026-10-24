// /api/oncology-survivorship — validation, AI-refinement guardrails, decision store.
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

const generate = vi.fn();
vi.mock("../server/services/ai-gateway", () => ({ generatePhiSafeText: (...a: unknown[]) => generate(...a) }));
vi.mock("../server/security/hipaa-audit", () => ({ logPhiAccess: vi.fn() }));
vi.mock("../server/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
  getLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));

import router from "../server/routes/oncology-survivorship-routes";

let server: Server;
let base = "";

const caseBody = {
  primarySite: "breast",
  histology: "Invasive ductal carcinoma",
  stage: "IIA",
  diagnosisDate: "2021-03-15",
  status: "remission",
  biomarkers: [{ name: "ER", value: "95%", status: "positive" }],
  studies: [{ id: "i1", kind: "imaging", date: "2025-06-10", title: "Mammogram", modality: "Mammogram", response: "ned", impression: "Jane Roe, MRN 12345 — no suspicious findings" }],
  treatments: [
    { id: "t1", modality: "chemotherapy", title: "AC", start: "2021-06-01", end: "2021-10-01", agents: ["Doxorubicin"], cumulativeDoseMgM2: [{ agent: "Doxorubicin", dose: 240 }] },
  ],
};
const analyze = { case: caseBody, context: { age: 52, sex: "female" } };

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { user: unknown }).user = { claims: { sub: "clinician-1" } };
    next();
  });
  app.use("/api/oncology-survivorship", router);
  await new Promise<void>((r) => {
    server = app.listen(0, () => r());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/oncology-survivorship`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));
beforeEach(() => generate.mockReset());

const post = (path: string, body: unknown) => fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("analyze", () => {
  it("returns course, suggestions and a clinician summary; marks responses no-store", async () => {
    const res = await post("/analyze", analyze);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toMatch(/no-store/);
    const j = await res.json();
    expect(j.course.primarySite).toBe("breast");
    expect(j.suggestions.generatedFor).toBe("clinician");
    expect(j.suggestions.suggestions.map((s: { id: string }) => s.id)).toContain("cardiac-surveillance");
    expect(j.clinicianSummary).toMatch(/SURVIVORSHIP CONSIDERATIONS/);
  });
  it("rejects malformed input", async () => {
    expect((await post("/analyze", { case: { primarySite: "" } })).status).toBe(400);
    expect((await post("/analyze", { ...analyze, case: { ...caseBody, diagnosisDate: "March 2021" } })).status).toBe(400);
    expect((await post("/analyze", { ...analyze, case: { ...caseBody, studies: Array(501).fill(caseBody.studies[0]) } })).status).toBe(400);
  });
});

describe("refine", () => {
  it("annotates only known ids, clamps priority to one step, and keeps PHI text out of the prompt", async () => {
    generate.mockResolvedValue(
      JSON.stringify({
        courseNarrative: "Stage IIA IDC treated with anthracycline.",
        items: [
          { id: "cardiac-surveillance", adjustedPriority: "consider", patientSpecificRationale: "Dose is close to the high-risk threshold.", dataToConfirm: ["Confirm trastuzumab history"] },
          { id: "made-up-rule", patientSpecificRationale: "should be discarded" },
          { id: "psychosocial-distress", adjustedPriority: "high" },
        ],
        clarifyingQuestions: ["Was radiation given?"],
      }),
    );
    const res = await post("/refine", analyze);
    const j = await res.json();
    expect(j.aiRefined).toBe(true);
    expect(j.courseNarrative).toMatch(/anthracycline/);
    const ids = j.refinements.map((r: { id: string }) => r.id);
    expect(ids).toEqual(["cardiac-surveillance", "psychosocial-distress"]);
    const cardiac = j.refinements.find((r: { id: string }) => r.id === "cardiac-surveillance");
    // 240 mg/m² alone is intermediate -> routine; AI asked for "consider" (one step down) which is allowed.
    expect(cardiac.priorityAfter).toBe("consider");
    const distress = j.refinements.find((r: { id: string }) => r.id === "psychosocial-distress");
    // routine -> high is exactly one step, allowed.
    expect(distress.priorityAfter).toBe("high");

    const prompt = generate.mock.calls[0][0] as { user: string; system: string; purpose: string };
    expect(prompt.purpose).toBe("oncology-survivorship-refine");
    expect(prompt.user).not.toMatch(/Jane Roe|12345|2021-03-15|2025-06-10/);
    expect(prompt.system).toMatch(/do NOT create new recommendations/i);
  });

  it("never lets a rule-assigned high priority fall below routine, nor consider jump to high", async () => {
    generate.mockResolvedValue(
      JSON.stringify({ items: [{ id: "care-plan-treatment-summary", adjustedPriority: "consider" }, { id: "fatigue-function", adjustedPriority: "high" }] }),
    );
    const j = await (await post("/refine", analyze)).json();
    const care = j.refinements.find((r: { id: string }) => r.id === "care-plan-treatment-summary");
    const fatigue = j.refinements.find((r: { id: string }) => r.id === "fatigue-function");
    expect(care.priorityBefore).toBe("high");
    expect(care.priorityAfter).toBe("routine");
    expect(fatigue.priorityBefore).toBe("consider");
    expect(fatigue.priorityAfter).toBe("routine");
  });

  it("falls back to the deterministic list when the model fails or returns junk", async () => {
    generate.mockRejectedValueOnce(new Error("vertex down"));
    let j = await (await post("/refine", analyze)).json();
    expect(j.aiRefined).toBe(false);
    expect(j.aiUnavailable).toBe(true);
    expect(j.suggestions.suggestions.length).toBeGreaterThan(0);

    generate.mockResolvedValueOnce("not json");
    j = await (await post("/refine", analyze)).json();
    expect(j.aiUnavailable).toBe(true);

    generate.mockResolvedValueOnce(JSON.stringify({ items: [{ id: "x".repeat(200) }] }));
    j = await (await post("/refine", analyze)).json();
    expect(j.aiUnavailable).toBe(true);
  });
});

describe("decisions", () => {
  it("stores a clinician decision and returns it on analyze", async () => {
    const put = await fetch(`${base}/patients/pt-1/decisions/bone-health`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "completed", note: "DEXA done" }),
    });
    expect(put.status).toBe(200);
    expect((await put.json()).decision.decidedBy).toBe("clinician-1");

    const list = await (await fetch(`${base}/patients/pt-1/decisions`)).json();
    expect(list.decisions["bone-health"].status).toBe("completed");

    const j = await (await post("/analyze?patientId=pt-1", analyze)).json();
    expect(j.decisions["bone-health"].note).toBe("DEXA done");

    const other = await (await fetch(`${base}/patients/pt-2/decisions`)).json();
    expect(other.decisions).toEqual({});
  });
  it("validates ids and status", async () => {
    const bad = (path: string, body: unknown) => fetch(`${base}${path}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    expect((await bad("/patients/pt-1/decisions/bone-health", { status: "ignored" })).status).toBe(400);
    expect((await bad("/patients/pt-1/decisions/Bone_Health", { status: "accepted" })).status).toBe(400);
    expect((await bad("/patients/bad%20id/decisions/bone-health", { status: "accepted" })).status).toBe(400);
  });
});
