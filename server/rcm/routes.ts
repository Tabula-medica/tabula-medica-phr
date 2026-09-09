// /api/rcm — the outpatient RCM API. Zod-validated, tenant-scoped (header x-tenant-id or the
// authenticated user's sub), stub-by-default vendors, agents gated behind approvals.
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { rcmStore } from "./store";
import { checkEligibility, detectDiscrepancies, estimatePatientResponsibility, financialClearance, parse271 } from "./eligibility";
import { authCoversService, createAuthRequest, DEFAULT_AUTH_RULES, requiresPriorAuth, transitionAuth, type AuthStatus } from "./prior-auth";
import { chargeMasterCatalog, deriveCharges, detectChargeGaps, parseVoiceCharge, voiceCommandsToLines } from "./charge-capture";
import { buildCodingPrompt, CODING_SYSTEM_PROMPT, levelEm, parseCodingSuggestion, reviewIcd, stubCodingSuggestion } from "./coding";
import { applyAutoFixes, scrubClaim, scrubRuleCatalog } from "./scrubber";
import { buildClaim, claimTo837P, claimToCms1500Boxes, claimsNeedingFollowUp, correctedClaim, secondaryClaim, transitionClaim } from "./claims";
import { claimStatusFromPosting, parseEra, postRemittance } from "./remittance";
import { analyzeDenial, CARC_MAP, denialFromAdjustment, denialTrends, generateAppealLetter, recommendAction } from "./denials";
import { buildStatement, computeAccount, computeAging, createPaymentPlan, detectCreditBalances, fplPercent, goodFaithEstimate, propensityToPay, slidingFeeDiscount } from "./patient-financials";
import { expectedForLines, modelContractChange, varianceReport } from "./contracts";
import { agingByPayer, computeKpis, payerScorecard } from "./analytics";
import { itemsFromDenials, itemsFromScrub, makeWorkItem, queueSummary, sortQueue } from "./worklists";
import { parseVoiceIntent, speakIntent, speakKpis } from "./voice";
import { agentRuntime } from "./agents";
import { aiJson } from "./agents/ai";
import { seedDemoTenant } from "./demo-seed";
import { daysBetween, todayIso } from "./util";
import type { Claim, Diagnosis, ServiceLine, WorkQueue } from "./types";

export const rcmRouter = Router();

interface AuthedRequest extends Request { user?: { claims?: { sub?: string } } }
function tenantOf(req: Request): string {
  const h = req.header("x-tenant-id");
  if (h && /^[A-Za-z0-9_-]{1,64}$/.test(h)) return h;
  return (req as AuthedRequest).user?.claims?.sub ?? "demo";
}
function actorOf(req: Request): string { return (req as AuthedRequest).user?.claims?.sub ?? "anonymous"; }

function fail(res: Response, status: number, error: string, details?: unknown) { return res.status(status).json({ success: false, error, details }); }
function bad(res: Response, e: z.ZodError) { return fail(res, 400, "Validation failed", e.flatten()); }
const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response) => { fn(req, res).catch((e) => { console.error("[rcm]", e); if (!res.headersSent) fail(res, 500, e instanceof Error ? e.message : "Internal error"); }); };

const patientSchema = z.object({ id: z.string().min(1), mrn: z.string().optional(), firstName: z.string().min(1), lastName: z.string().min(1), dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), sex: z.enum(["M", "F", "U"]).optional(), phone: z.string().optional(), email: z.string().optional(), preferredLanguage: z.string().optional(), householdSize: z.number().int().positive().optional(), annualHouseholdIncome: z.number().nonnegative().optional() });
const coverageSchema = z.object({ id: z.string().min(1), patientId: z.string().min(1), payerId: z.string().min(1), payerName: z.string().min(1), memberId: z.string().min(1), groupNumber: z.string().optional(), planType: z.enum(["HMO", "PPO", "EPO", "POS", "Medicare", "Medicaid", "Commercial", "SelfPay", "Other"]).optional(), priority: z.enum(["primary", "secondary", "tertiary"]), subscriberRelationship: z.enum(["self", "spouse", "child", "other"]), subscriberFirstName: z.string().optional(), subscriberLastName: z.string().optional(), subscriberDob: z.string().optional(), effectiveDate: z.string().optional(), terminationDate: z.string().optional(), timelyFilingDays: z.number().int().positive().optional() });
const lineSchema = z.object({ id: z.string().optional(), cpt: z.string().min(4).max(7), description: z.string().optional(), modifiers: z.array(z.string()).default([]), units: z.number().positive().default(1), charge: z.number().nonnegative(), dxPointers: z.array(z.number().int()).default([1]), dateOfService: z.string(), placeOfService: z.string().default("11"), renderingNpi: z.string().optional(), ndc: z.string().optional() });
const dxSchema = z.object({ code: z.string().min(3), description: z.string().optional(), hcc: z.boolean().optional() });

// ---------- Demo / health ----------
rcmRouter.get("/health", (_req, res) => res.json({ success: true, module: "rcm", aiEnabled: (process.env.RCM_AI_ENABLED ?? "false") === "true", vendors: { eligibility: "stub", clearinghouse: "stub" }, agents: agentRuntime.list().map((a) => a.name) }));
rcmRouter.post("/demo/seed", wrap(async (req, res) => { const t = tenantOf(req); rcmStore.reset(t); const r = await seedDemoTenant(rcmStore, t); res.json({ success: true, ...r }); }));

// ---------- Patients & coverage ----------
rcmRouter.post("/patients", wrap(async (req, res) => { const p = patientSchema.safeParse(req.body); if (!p.success) return bad(res, p.error); res.json({ success: true, patient: await rcmStore.upsertPatient(tenantOf(req), p.data) }); }));
rcmRouter.get("/patients", wrap(async (req, res) => res.json({ success: true, patients: await rcmStore.listPatients(tenantOf(req)) })));
rcmRouter.post("/coverage", wrap(async (req, res) => { const p = coverageSchema.safeParse(req.body); if (!p.success) return bad(res, p.error); res.json({ success: true, coverage: await rcmStore.upsertCoverage(tenantOf(req), p.data) }); }));
rcmRouter.get("/patients/:id/coverage", wrap(async (req, res) => res.json({ success: true, coverages: await rcmStore.coveragesForPatient(tenantOf(req), req.params.id) })));

// ---------- Eligibility & clearance ----------
rcmRouter.post("/eligibility/check", wrap(async (req, res) => {
  const p = z.object({ coverageId: z.string(), dateOfService: z.string().default(todayIso()), providerNpi: z.string().default("1234567893"), plannedLines: z.array(z.object({ cpt: z.string(), units: z.number().default(1) })).default([{ cpt: "99213", units: 1 }]), payerResponse: z.unknown().optional() }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const t = tenantOf(req);
  const coverage = await rcmStore.getCoverage(t, p.data.coverageId);
  if (!coverage) return fail(res, 404, "coverage not found");
  const patient = await rcmStore.getPatient(t, coverage.patientId);
  if (!patient) return fail(res, 404, "patient not found");
  const benefits = p.data.payerResponse ? parse271(p.data.payerResponse) : await checkEligibility({ patient, coverage, dateOfService: p.data.dateOfService, providerNpi: p.data.providerNpi });
  await rcmStore.setBenefits(t, coverage.id, benefits);
  const contract = await rcmStore.getContract(t, coverage.payerId);
  const estimate = estimatePatientResponsibility(p.data.plannedLines, benefits, contract?.feeSchedule);
  const discrepancies = detectDiscrepancies({ firstName: patient.firstName, lastName: patient.lastName, dob: patient.dob, memberId: coverage.memberId }, {});
  const needAuth = p.data.plannedLines.some((l) => requiresPriorAuth(l.cpt, contract).required);
  const auths = await rcmStore.listAuths(t, patient.id);
  const authOnFile = p.data.plannedLines.every((l) => !requiresPriorAuth(l.cpt, contract).required || auths.some((a) => authCoversService(a, l.cpt, p.data.dateOfService).ok));
  const clearance = financialClearance(benefits, estimate, discrepancies, { requiresAuth: needAuth, authOnFile });
  res.json({ success: true, benefits, estimate, discrepancies, clearance });
}));

// ---------- Prior auth ----------
rcmRouter.get("/prior-auth/rules", (_req, res) => res.json({ success: true, rules: DEFAULT_AUTH_RULES }));
rcmRouter.get("/prior-auth", wrap(async (req, res) => res.json({ success: true, auths: await rcmStore.listAuths(tenantOf(req), typeof req.query.patientId === "string" ? req.query.patientId : undefined) })));
rcmRouter.post("/prior-auth", wrap(async (req, res) => {
  const p = z.object({ patientId: z.string(), coverageId: z.string(), payerId: z.string(), cpt: z.string(), diagnoses: z.array(z.string()).default([]), units: z.number().int().positive().optional(), urgency: z.enum(["standard", "urgent"]).optional(), availableDocs: z.array(z.string()).optional(), submit: z.boolean().default(false) }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  let auth = createAuthRequest(p.data);
  if (p.data.submit) auth = transitionAuth(auth, "requested", { actor: actorOf(req) });
  res.json({ success: true, auth: await rcmStore.upsertAuth(tenantOf(req), auth) });
}));
rcmRouter.post("/prior-auth/:id/transition", wrap(async (req, res) => {
  const p = z.object({ to: z.enum(["not-required", "required", "requested", "pended", "approved", "denied", "expired", "exhausted"]), note: z.string().optional(), authNumber: z.string().optional(), validFrom: z.string().optional(), validTo: z.string().optional(), approvedUnits: z.number().int().positive().optional() }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const t = tenantOf(req);
  const auth = await rcmStore.getAuth(t, req.params.id);
  if (!auth) return fail(res, 404, "auth not found");
  res.json({ success: true, auth: await rcmStore.upsertAuth(t, transitionAuth(auth, p.data.to as AuthStatus, { actor: actorOf(req), ...p.data })) });
}));

// ---------- Charge capture & coding ----------
rcmRouter.get("/charge-master", (_req, res) => res.json({ success: true, catalog: chargeMasterCatalog() }));
rcmRouter.post("/charges/derive", wrap(async (req, res) => {
  const p = z.object({ encounterId: z.string(), patientId: z.string(), dateOfService: z.string(), placeOfService: z.string().default("11"), renderingNpi: z.string(), newPatient: z.boolean().default(false), telehealth: z.boolean().optional(), emLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(), proceduresDocumented: z.array(z.string()).default([]), ordersCompleted: z.array(z.string()).default([]), vaccinesGiven: z.number().int().nonnegative().default(0), diagnoses: z.array(dxSchema).default([]), visitComplexityAddOn: z.boolean().optional(), enteredAt: z.string().optional() }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const lines = deriveCharges(p.data);
  const gaps = detectChargeGaps(p.data, lines, { enteredAt: p.data.enteredAt });
  if (p.data.enteredAt) await rcmStore.recordChargeLag(tenantOf(req), daysBetween(p.data.dateOfService, p.data.enteredAt));
  res.json({ success: true, lines, gaps, total: lines.reduce((s, l) => s + l.charge, 0) });
}));
rcmRouter.post("/charges/voice", wrap(async (req, res) => {
  const p = z.object({ transcript: z.string().min(1), dateOfService: z.string().default(todayIso()), placeOfService: z.string().default("11"), renderingNpi: z.string().default("1234567893"), diagnoses: z.array(dxSchema).default([]), telehealth: z.boolean().optional() }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const commands = parseVoiceCharge(p.data.transcript);
  const built = voiceCommandsToLines(commands, p.data);
  res.json({ success: true, commands, ...built, speak: speakIntent({ type: "charge-capture", commands }) });
}));
rcmRouter.post("/coding/level", wrap(async (req, res) => {
  const p = z.object({ problems: z.array(z.object({ severity: z.enum(["minimal", "self-limited", "stable-chronic", "acute-uncomplicated", "chronic-exacerbation", "undiagnosed-uncertain", "acute-systemic", "chronic-severe-exacerbation", "life-threatening"]) })), uniqueTestsOrderedOrReviewed: z.number().int().nonnegative().default(0), externalNotesReviewed: z.number().int().nonnegative().default(0), independentHistorian: z.boolean().default(false), independentInterpretation: z.boolean().default(false), discussionWithExternalPhysician: z.boolean().default(false), risk: z.enum(["minimal", "low", "moderate", "high"]), totalTimeMinutes: z.number().positive().optional(), newPatient: z.boolean().default(false) }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  res.json({ success: true, result: levelEm(p.data) });
}));
rcmRouter.post("/coding/review-icd", wrap(async (req, res) => { const p = z.object({ codes: z.array(z.string()), activeProblems: z.array(z.string()).default([]) }).safeParse(req.body); if (!p.success) return bad(res, p.error); res.json({ success: true, findings: reviewIcd(p.data.codes, p.data.activeProblems) }); }));
rcmRouter.post("/coding/suggest", wrap(async (req, res) => {
  const p = z.object({ note: z.object({ subjective: z.string(), objective: z.string(), assessment: z.string(), plan: z.string() }), problems: z.array(z.string()).default([]), newPatient: z.boolean().default(false), timeMinutes: z.number().optional() }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const { value, source } = await aiJson(CODING_SYSTEM_PROMPT, buildCodingPrompt(p.data.note, p.data.problems, p.data.newPatient, p.data.timeMinutes), (t) => parseCodingSuggestion(t, "vertex"), () => stubCodingSuggestion(p.data.problems, p.data.newPatient), "rcm-coding");
  res.json({ success: true, suggestion: { ...value, source } });
}));

// ---------- Claims ----------
rcmRouter.get("/scrub/rules", (_req, res) => res.json({ success: true, rules: scrubRuleCatalog() }));
rcmRouter.post("/claims", wrap(async (req, res) => {
  const p = z.object({ encounterId: z.string(), patientId: z.string(), coverageId: z.string(), billingNpi: z.string(), billingTaxId: z.string().optional(), renderingNpi: z.string(), renderingProviderName: z.string().optional(), placeOfService: z.string().default("11"), diagnoses: z.array(dxSchema).min(0), lines: z.array(lineSchema), priorAuthNumber: z.string().optional(), referralNumber: z.string().optional() }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const t = tenantOf(req);
  const patient = await rcmStore.getPatient(t, p.data.patientId);
  const coverage = await rcmStore.getCoverage(t, p.data.coverageId);
  if (!patient || !coverage) return fail(res, 404, "patient or coverage not found");
  const claim = buildClaim({ ...p.data, patient, coverage, diagnoses: p.data.diagnoses as Diagnosis[], lines: p.data.lines as ServiceLine[] });
  res.json({ success: true, claim: await rcmStore.upsertClaim(t, claim) });
}));
rcmRouter.get("/claims", wrap(async (req, res) => { const status = typeof req.query.status === "string" ? (req.query.status as Claim["status"]) : undefined; res.json({ success: true, claims: await rcmStore.listClaims(tenantOf(req), { status }) }); }));
rcmRouter.get("/claims/followup", wrap(async (req, res) => res.json({ success: true, rows: claimsNeedingFollowUp(await rcmStore.listClaims(tenantOf(req)), todayIso()) })));
rcmRouter.get("/claims/:id", wrap(async (req, res) => { const c = await rcmStore.getClaim(tenantOf(req), req.params.id); return c ? res.json({ success: true, claim: c }) : fail(res, 404, "claim not found"); }));
rcmRouter.post("/claims/:id/scrub", wrap(async (req, res) => {
  const t = tenantOf(req);
  const claim = await rcmStore.getClaim(t, req.params.id);
  if (!claim) return fail(res, 404, "claim not found");
  const patient = await rcmStore.getPatient(t, claim.patientId);
  const coverage = await rcmStore.getCoverage(t, claim.coverageId);
  const contract = await rcmStore.getContract(t, claim.payerId);
  const others = (await rcmStore.listClaims(t, { patientId: claim.patientId })).filter((c) => c.id !== claim.id);
  const ctx = { patient, coverage, authRequiredCpts: contract?.requiresAuth, authOnFile: !!claim.priorAuthNumber, priorClaimsSameDos: others };
  const result = scrubClaim(claim, ctx);
  await rcmStore.recordScrub(t, result.clean);
  const applyFixes = req.body?.applyAutoFixes === true;
  let next = claim;
  let applied: string[] = [];
  let finalResult = result;
  if (applyFixes) { const f = applyAutoFixes(claim, result.edits); next = f.claim; applied = f.applied; finalResult = scrubClaim(next, ctx); }
  if (next.status === "draft") next = transitionClaim(next, "scrubbed", actorOf(req), `score ${finalResult.score}`);
  if (finalResult.clean && next.status === "scrubbed") next = transitionClaim(next, "ready", actorOf(req), "clean");
  await rcmStore.upsertClaim(t, next);
  if (!finalResult.clean) await rcmStore.addWorkItems(t, itemsFromScrub(next, finalResult.errors.length));
  res.json({ success: true, result: finalResult, applied, claim: next });
}));
rcmRouter.post("/claims/:id/transition", wrap(async (req, res) => {
  const p = z.object({ to: z.string(), note: z.string().optional() }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const t = tenantOf(req);
  const claim = await rcmStore.getClaim(t, req.params.id);
  if (!claim) return fail(res, 404, "claim not found");
  try { res.json({ success: true, claim: await rcmStore.upsertClaim(t, transitionClaim(claim, p.data.to as Claim["status"], actorOf(req), p.data.note)) }); } catch (e) { fail(res, 409, e instanceof Error ? e.message : "illegal transition"); }
}));
rcmRouter.get("/claims/:id/837p", wrap(async (req, res) => { const t = tenantOf(req); const c = await rcmStore.getClaim(t, req.params.id); if (!c) return fail(res, 404, "claim not found"); const p = await rcmStore.getPatient(t, c.patientId); const cov = await rcmStore.getCoverage(t, c.coverageId); if (!p || !cov) return fail(res, 404, "patient/coverage missing"); res.json({ success: true, x12: claimTo837P(c, p, cov), cms1500: claimToCms1500Boxes(c, p, cov) }); }));
rcmRouter.post("/claims/:id/corrected", wrap(async (req, res) => { const t = tenantOf(req); const c = await rcmStore.getClaim(t, req.params.id); if (!c) return fail(res, 404, "claim not found"); const kind = req.body?.kind === "8" ? "8" : "7"; const next = correctedClaim(c, { diagnoses: req.body?.diagnoses, lines: req.body?.lines, priorAuthNumber: req.body?.priorAuthNumber }, kind); res.json({ success: true, claim: await rcmStore.upsertClaim(t, next) }); }));
rcmRouter.post("/claims/:id/secondary", wrap(async (req, res) => {
  const p = z.object({ secondaryCoverageId: z.string(), primaryRemit: z.object({ paid: z.number(), patientResp: z.number(), billed: z.number(), lines: z.array(z.any()).default([]) }) }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const t = tenantOf(req);
  const c = await rcmStore.getClaim(t, req.params.id);
  const cov = await rcmStore.getCoverage(t, p.data.secondaryCoverageId);
  if (!c || !cov) return fail(res, 404, "claim or coverage not found");
  res.json({ success: true, claim: await rcmStore.upsertClaim(t, secondaryClaim(c, cov, { ...p.data.primaryRemit, lines: [] })) });
}));

// ---------- Remittance ----------
rcmRouter.post("/remittance/post", wrap(async (req, res) => {
  const t = tenantOf(req);
  const rem = parseEra(req.body?.era ?? req.body);
  const claimsById = await rcmStore.claimsById(t);
  const contracts = await rcmStore.contracts(t);
  const result = postRemittance(rem, claimsById, contracts);
  const created: string[] = [];
  for (const p of result.postings) {
    await rcmStore.postLedger(t, p.entries);
    const claim = p.claimId ? claimsById[p.claimId] : undefined;
    if (claim) {
      const to = claimStatusFromPosting(p);
      let next = claim;
      for (const hop of [to] as Claim["status"][]) { try { next = transitionClaim(next, hop, "era-post"); } catch { /* keep current status when transition not allowed */ } }
      await rcmStore.upsertClaim(t, next);
      const contract = contracts[claim.payerId];
      for (const adj of p.denials) { const d = denialFromAdjustment(claim, adj, { appealDays: contract?.appealDays, receivedAt: rem.receivedAt }); await rcmStore.upsertDenial(t, d); created.push(d.id); }
      if (p.underpayment) await rcmStore.addWorkItems(t, [makeWorkItem({ queue: "underpayments", title: `Underpaid $${p.underpayment.variance.toFixed(2)} vs contract (${claim.payerName})`, patientId: claim.patientId, claimId: claim.id, amount: p.underpayment.variance, priority: 65, source: "system", context: { ...p.underpayment } })]);
    }
  }
  const denials = (await rcmStore.listDenials(t, "open")).filter((d) => created.includes(d.id));
  await rcmStore.addWorkItems(t, itemsFromDenials(denials));
  await rcmStore.addRemittance(t, { ...rem, postedAt: new Date().toISOString() });
  res.json({ success: true, remittance: rem, postings: result.postings, unapplied: result.unapplied, balanced: result.balanced, denialsCreated: created });
}));
rcmRouter.get("/remittance", wrap(async (req, res) => res.json({ success: true, remittances: await rcmStore.listRemittances(tenantOf(req)) })));

// ---------- Denials ----------
rcmRouter.get("/denials/carc", (_req, res) => res.json({ success: true, carc: CARC_MAP }));
rcmRouter.get("/denials/analyze/:carc", (req, res) => res.json({ success: true, analysis: analyzeDenial(req.params.carc, typeof req.query.rarc === "string" ? req.query.rarc : undefined) }));
rcmRouter.get("/denials", wrap(async (req, res) => { const list = await rcmStore.listDenials(tenantOf(req)); res.json({ success: true, denials: list.sort((a, b) => b.priorityScore - a.priorityScore), trends: denialTrends(list) }); }));
rcmRouter.post("/denials/:id/appeal", wrap(async (req, res) => {
  const t = tenantOf(req);
  const d = await rcmStore.getDenial(t, req.params.id);
  if (!d) return fail(res, 404, "denial not found");
  const claim = await rcmStore.getClaim(t, d.claimId);
  const patient = await rcmStore.getPatient(t, d.patientId);
  if (!claim) return fail(res, 404, "claim not found");
  const letter = generateAppealLetter({ denial: d, claim, patientName: patient ? `${patient.firstName} ${patient.lastName}` : "Patient", providerName: claim.renderingProviderName ?? "Rendering Provider", practiceName: req.body?.practiceName ?? "World EHR Outpatient", clinicalSummary: req.body?.clinicalSummary, policyCitation: req.body?.policyCitation, attachments: req.body?.attachments });
  res.json({ success: true, ...letter, recommendation: recommendAction(d) });
}));
rcmRouter.post("/denials/:id/status", wrap(async (req, res) => { const p = z.object({ status: z.enum(["open", "in-progress", "appealed", "overturned", "upheld", "written-off"]) }).safeParse(req.body); if (!p.success) return bad(res, p.error); const t = tenantOf(req); const d = await rcmStore.getDenial(t, req.params.id); if (!d) return fail(res, 404, "denial not found"); res.json({ success: true, denial: await rcmStore.upsertDenial(t, { ...d, status: p.data.status }) }); }));

// ---------- Patient financials ----------
rcmRouter.get("/patients/:id/account", wrap(async (req, res) => { const t = tenantOf(req); const entries = await rcmStore.ledger(t, req.params.id); res.json({ success: true, summary: computeAccount(req.params.id, entries), aging: computeAging(entries), entries }); }));
rcmRouter.get("/patients/:id/statement", wrap(async (req, res) => { const t = tenantOf(req); const p = await rcmStore.getPatient(t, req.params.id); if (!p) return fail(res, 404, "patient not found"); const cycle = (["1", "2", "3", "final"].includes(String(req.query.cycle)) ? (req.query.cycle === "final" ? "final" : Number(req.query.cycle)) : 1) as 1 | 2 | 3 | "final"; res.json({ success: true, statement: buildStatement(p, await rcmStore.ledger(t, p.id), cycle) }); }));
rcmRouter.post("/patients/:id/propensity", wrap(async (req, res) => { const t = tenantOf(req); const p = await rcmStore.getPatient(t, req.params.id); if (!p) return fail(res, 404, "patient not found"); const s = computeAccount(p.id, await rcmStore.ledger(t, p.id)); const fpl = p.annualHouseholdIncome !== undefined && p.householdSize ? fplPercent(p.annualHouseholdIncome, p.householdSize) : undefined; res.json({ success: true, propensity: propensityToPay({ balance: s.patientBalance, priorStatementsPaidOnTime: req.body?.paidOnTime ?? 0, priorStatementsLate: req.body?.late ?? 0, hasCardOnFile: !!req.body?.hasCardOnFile, fplPct: fpl }), fplPct: fpl, slidingFee: fpl !== undefined ? slidingFeeDiscount(fpl) : undefined }); }));
rcmRouter.post("/patients/:id/payment-plan", wrap(async (req, res) => { const p = z.object({ total: z.number().positive(), months: z.number().int().positive().max(36), startDate: z.string().optional(), autoPay: z.boolean().default(false) }).safeParse(req.body); if (!p.success) return bad(res, p.error); res.json({ success: true, plan: createPaymentPlan(req.params.id, p.data.total, p.data.months, p.data.startDate, p.data.autoPay) }); }));
rcmRouter.post("/patients/:id/gfe", wrap(async (req, res) => { const p = z.object({ lines: z.array(z.object({ cpt: z.string(), units: z.number().default(1) })), selfPayRates: z.record(z.number()).default({}), scheduledDate: z.string().optional() }).safeParse(req.body); if (!p.success) return bad(res, p.error); const t = tenantOf(req); const pt = await rcmStore.getPatient(t, req.params.id); if (!pt) return fail(res, 404, "patient not found"); res.json({ success: true, gfe: goodFaithEstimate(pt, p.data.lines, p.data.selfPayRates, p.data.scheduledDate) }); }));
rcmRouter.post("/ledger", wrap(async (req, res) => { const p = z.array(z.object({ id: z.string().optional(), patientId: z.string(), claimId: z.string().optional(), type: z.enum(["charge", "insurance-payment", "patient-payment", "contractual-adjustment", "denial-adjustment", "write-off", "refund", "transfer-to-patient"]), amount: z.number().nonnegative(), date: z.string(), memo: z.string().optional(), responsibleParty: z.enum(["insurance", "patient"]).default("patient") })).safeParse(req.body?.entries ?? req.body); if (!p.success) return bad(res, p.error); const entries = p.data.map((e, i) => ({ ...e, id: e.id ?? `led_${Date.now().toString(36)}_${i}` })); await rcmStore.postLedger(tenantOf(req), entries); res.json({ success: true, posted: entries.length }); }));
rcmRouter.get("/credit-balances", wrap(async (req, res) => res.json({ success: true, credits: detectCreditBalances(await rcmStore.ledgerByPatient(tenantOf(req))) })));

// ---------- Contracts ----------
rcmRouter.get("/contracts", wrap(async (req, res) => res.json({ success: true, contracts: Object.values(await rcmStore.contracts(tenantOf(req))) })));
rcmRouter.post("/contracts/:payerId/expected", wrap(async (req, res) => { const c = await rcmStore.getContract(tenantOf(req), req.params.payerId); if (!c) return fail(res, 404, "contract not found"); const lines = z.array(z.object({ cpt: z.string(), units: z.number().default(1), modifiers: z.array(z.string()).default([]) })).parse(req.body?.lines ?? []); res.json({ success: true, expected: expectedForLines(c, lines) }); }));
rcmRouter.post("/contracts/:payerId/variance", wrap(async (req, res) => { const c = await rcmStore.getContract(tenantOf(req), req.params.payerId); if (!c) return fail(res, 404, "contract not found"); const lines = z.array(z.object({ cpt: z.string(), units: z.number().default(1), modifiers: z.array(z.string()).default([]), allowed: z.number() })).parse(req.body?.lines ?? []); res.json({ success: true, ...varianceReport(c, lines) }); }));
rcmRouter.post("/contracts/:payerId/model", wrap(async (req, res) => { const c = await rcmStore.getContract(tenantOf(req), req.params.payerId); if (!c) return fail(res, 404, "contract not found"); const p = z.object({ volume: z.array(z.object({ cpt: z.string(), units: z.number() })), pctChange: z.number().optional(), overrides: z.record(z.number()).optional() }).safeParse(req.body); if (!p.success) return bad(res, p.error); res.json({ success: true, ...modelContractChange(c, p.data.volume, p.data) }); }));

// ---------- Analytics ----------
rcmRouter.get("/analytics/kpis", wrap(async (req, res) => { const t = tenantOf(req); const stats = await rcmStore.scrubStats(t); const claims = await rcmStore.listClaims(t); const denials = await rcmStore.listDenials(t); const remittances = await rcmStore.listRemittances(t); res.json({ success: true, kpis: computeKpis({ claims, denials, ledger: await rcmStore.ledger(t), remittances, scrubTotal: stats.total, scrubFirstPassClean: stats.firstPassClean, chargeEntryLagDays: await rcmStore.chargeLagSamples(t) }), agingByPayer: agingByPayer(claims), payerScorecard: payerScorecard(claims, denials, remittances), denialTrends: denialTrends(denials) }); }));

// ---------- Work queues ----------
rcmRouter.get("/worklist", wrap(async (req, res) => { const t = tenantOf(req); const q = typeof req.query.queue === "string" ? (req.query.queue as WorkQueue) : undefined; const items = await rcmStore.listWorkItems(t, q); res.json({ success: true, items: sortQueue(items), summary: queueSummary(await rcmStore.listWorkItems(t)) }); }));
rcmRouter.post("/worklist/:id", wrap(async (req, res) => { const p = z.object({ status: z.enum(["open", "in-progress", "waiting", "done", "cancelled"]).optional(), assignedTo: z.string().optional() }).safeParse(req.body); if (!p.success) return bad(res, p.error); const w = await rcmStore.updateWorkItem(tenantOf(req), req.params.id, p.data); return w ? res.json({ success: true, item: w }) : fail(res, 404, "work item not found"); }));

// ---------- Voice ----------
rcmRouter.post("/voice/command", wrap(async (req, res) => {
  const p = z.object({ transcript: z.string().min(1) }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const intent = parseVoiceIntent(p.data.transcript);
  let speak = speakIntent(intent);
  if (intent.type === "kpi-readout") { const t = tenantOf(req); const stats = await rcmStore.scrubStats(t); const kpis = computeKpis({ claims: await rcmStore.listClaims(t), denials: await rcmStore.listDenials(t), ledger: await rcmStore.ledger(t), remittances: await rcmStore.listRemittances(t), scrubTotal: stats.total, scrubFirstPassClean: stats.firstPassClean }); speak = speakKpis(kpis, intent.kpi); }
  res.json({ success: true, intent, speak });
}));

// ---------- Agents & approvals ----------
rcmRouter.get("/agents", (_req, res) => res.json({ success: true, agents: agentRuntime.list() }));
rcmRouter.post("/agents/:name/run", wrap(async (req, res) => { try { res.json({ success: true, result: await agentRuntime.run(req.params.name, tenantOf(req), req.body?.args ?? {}, { actor: actorOf(req), dryRun: req.body?.dryRun === true }) }); } catch (e) { fail(res, 404, e instanceof Error ? e.message : "agent error"); } }));
rcmRouter.get("/agents/audit", wrap(async (req, res) => res.json({ success: true, audit: await rcmStore.listAudit(tenantOf(req)) })));
rcmRouter.get("/approvals", wrap(async (req, res) => res.json({ success: true, approvals: await rcmStore.listApprovals(tenantOf(req), typeof req.query.status === "string" ? (req.query.status as "pending" | "approved" | "rejected") : undefined) })));
rcmRouter.post("/approvals/:id", wrap(async (req, res) => {
  const p = z.object({ decision: z.enum(["approved", "rejected"]) }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const t = tenantOf(req);
  const a = await rcmStore.decideApproval(t, req.params.id, p.data.decision, actorOf(req));
  if (!a) return fail(res, 404, "approval not found");
  const wi = await rcmStore.findOpenWorkItem(t, (w) => w.queue === "agent-approval" && w.context?.approvalId === a.id);
  if (wi) await rcmStore.updateWorkItem(t, wi.id, { status: "done" });
  const exec = p.data.decision === "approved" ? await agentRuntime.executeApproved(t, a.id, actorOf(req)) : undefined;
  res.json({ success: true, approval: a, executed: exec });
}));

export default rcmRouter;
