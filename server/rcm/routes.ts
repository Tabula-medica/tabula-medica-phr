// /api/rcm — the outpatient RCM API. Zod-validated, tenant-scoped to the authenticated user's
// sub (never a client-supplied header — see tenantOf below), stub-by-default vendors, agents
// gated behind approvals.
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { rcmStore } from "./store";
import { checkEligibility, detectDiscrepancies, estimatePatientResponsibility, financialClearance, parse271 } from "./eligibility";
import { authCoversService, authorizedCptsOnFile, createAuthRequest, DEFAULT_AUTH_RULES, requiresPriorAuth, transitionAuth, type AuthStatus } from "./prior-auth";
import { chargeMasterCatalog, deriveCharges, detectChargeGaps, parseVoiceCharge, voiceCommandsToLines } from "./charge-capture";
import { buildCodingPrompt, CODING_SYSTEM_PROMPT, levelEm, parseCodingSuggestion, reviewIcd, stubCodingSuggestion } from "./coding";
import { applyAutoFixes, scrubClaim, scrubRuleCatalog } from "./scrubber";
import { applyClaimPatch, buildClaim, canTransition, claimTo837P, claimToCms1500Boxes, claimsNeedingFollowUp, correctedClaim, secondaryClaim, transitionClaim } from "./claims";
import { claimContentSignature, claimStatusFromPosting, parseEra, postRemittance } from "./remittance";
import { analyzeDenial, CARC_MAP, denialFromAdjustment, denialTrends, generateAppealLetter, recommendAction } from "./denials";
import { buildStatement, computeAccount, computeAging, createPaymentPlan, detectCreditBalances, fplPercent, goodFaithEstimate, patientLedgerLocks, paymentPlanLocks, propensityToPay, slidingFeeDiscount } from "./patient-financials";
import { expectedAllowed, expectedForLines, modelContractChange, varianceReport } from "./contracts";
import { agingByPayer, computeKpis, payerScorecard } from "./analytics";
import { itemsFromDenials, itemsFromScrub, makeWorkItem, queueSummary, sortQueue } from "./worklists";
import { parseVoiceIntent, speakIntent, speakKpis } from "./voice";
import { agentRuntime, isAuthSubmitLocked } from "./agents";
import { aiJson } from "./agents/ai";
import { seedDemoTenant } from "./demo-seed";
import { daysBetween, round2, sum, todayIso } from "./util";
import type { Claim, Diagnosis, ServiceLine, WorkQueue } from "./types";

export const rcmRouter = Router();

// In-process lock for /remittance/post: closes the check-then-post TOCTOU race between the
// duplicate-ERA lookup and the eventual addRemittance call, which are separated by several
// `await`s (ledger/claim writes) that let a second concurrent request slip through the same
// "not yet posted" check. `await` always yields at least one microtask tick even for an
// already-resolved value, so the lookup-then-write pair alone is not atomic; a synchronous
// check-and-set on this Set, done before any `await`, is — mirroring the AgentRuntime's own
// `executing` in-process lock for approval execution.
const remittancePostInFlight = new Set<string>();

interface AuthedRequest extends Request { user?: { claims?: { sub?: string } }; userRole?: string }
function tenantOf(req: Request): string {
  // Tenant identity must come from the authenticated session, never a client-supplied header —
  // this router is mounted behind isAuthenticated + requireRole, so `user.claims.sub` is always
  // present in production. Trusting `x-tenant-id` would let any logged-in caller read/mutate
  // another tenant's patients, claims, and ledger just by sending a different header value.
  return (req as AuthedRequest).user?.claims?.sub ?? "demo";
}
function actorOf(req: Request): string { return (req as AuthedRequest).user?.claims?.sub ?? "anonymous"; }

function fail(res: Response, status: number, error: string, details?: unknown) { return res.status(status).json({ success: false, error, details }); }
function bad(res: Response, e: z.ZodError) { return fail(res, 400, "Validation failed", e.flatten()); }

// Synchronous check-and-set, before any `await` (mirrors remittancePostInFlight/the other
// in-process locks in this module) — reset() is synchronous but seedDemoTenant() isn't, so a
// second /demo/seed call for the same tenant landing in that window would write into (or reseed
// on top of) a tenant this call had already emptied, interleaving two seeds into one dataset.
const demoSeedInFlight = new Set<string>();
// How many admitted mutating requests are currently executing per tenant — /demo/seed waits for
// this to drain to zero (see wrap() below for where it's tracked) before it actually resets the
// store, so a request already admitted before demoSeedInFlight was set can't write into the
// tenant after reset() clears it. Tracked around the handler function's OWN promise settling
// (inside wrap), not an Express response event: `res`'s "close" event fires as soon as the
// underlying connection drops, which for an aborted request can happen while the async handler
// is still awaiting a store call and will still resume and write afterward — using it as the
// release signal would let the seed loop see a false "zero in flight" while that write is still
// to come. The handler's own promise only settles once its code has actually finished running.
const tenantMutationsInFlight = new Map<string, number>();
// Tenant-wide maintenance lock, set only around /demo/seed's reset()-to-reseed-complete window.
// demoSeedInFlight alone only serializes /demo/seed calls against each other; it does nothing to
// stop an unrelated patient/claim/ledger write or an agent run (POST /agents/:name/run) from
// landing in the middle of that window, reading or writing into a tenant reset() has already
// emptied but seedDemoTenant() hasn't finished repopulating. Blocking every mutating request for
// the tenant here — ahead of all route handlers — closes that without threading a check through
// each one individually. GETs stay open (read-only, and blocking them would make the UI look
// broken during a routine reseed); /demo/seed itself is exempted so its own concurrent-call check
// below can return its more specific 409.
rcmRouter.use((req, res, next) => {
  if (req.method === "GET" || req.path === "/demo/seed") return next();
  if (demoSeedInFlight.has(tenantOf(req))) return fail(res, 503, "This account's RCM data is currently being reseeded — retry once the reseed completes");
  next();
});

const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response) => {
  // Track every mutating request's actual handler execution (see tenantMutationsInFlight above
  // for why this lives here, tied to the handler's own promise, rather than on a `res` event).
  // Excludes /demo/seed itself: it would otherwise wait on its own in-flight count and deadlock.
  const track = req.method !== "GET" && req.path !== "/demo/seed";
  const t = track ? tenantOf(req) : undefined;
  if (track && t) tenantMutationsInFlight.set(t, (tenantMutationsInFlight.get(t) ?? 0) + 1);
  fn(req, res)
    .catch((e) => { console.error("[rcm]", e); if (!res.headersSent) fail(res, 500, e instanceof Error ? e.message : "Internal error"); })
    .finally(() => {
      if (!track || !t) return;
      const remaining = (tenantMutationsInFlight.get(t) ?? 1) - 1;
      if (remaining <= 0) tenantMutationsInFlight.delete(t);
      else tenantMutationsInFlight.set(t, remaining);
    });
};

// Every DOS/effective/termination/scheduled date this router accepts eventually gets compared as
// a plain string (coverage effective/termination windows, auth validFrom/validTo, timely-filing
// deadlines) rather than parsed as a Date — a non-ISO value like "09/01/2026" would sort wrong
// against a stored "YYYY-MM-DD" and could silently bypass a termination/effective-date or
// timely-filing check instead of failing validation up front. One shared schema for all of them.
// The regex alone only checks the shape — it accepts an impossible calendar date like
// "2026-02-31", which `new Date(...)` silently rolls over into March while the raw string is
// still what gets compared elsewhere, producing inconsistent DOS/deadline decisions depending on
// which code path touches it. Require the parsed UTC date to round-trip back to the same string.
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be an ISO date (YYYY-MM-DD)").refine((v) => { const d = new Date(v); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v; }, "must be a real calendar date");
const patientSchema = z.object({ id: z.string().min(1), mrn: z.string().optional(), firstName: z.string().min(1), lastName: z.string().min(1), dob: isoDate, sex: z.enum(["M", "F", "U"]).optional(), phone: z.string().optional(), email: z.string().optional(), preferredLanguage: z.string().optional(), householdSize: z.number().int().positive().optional(), annualHouseholdIncome: z.number().nonnegative().optional() });
const coverageSchema = z.object({ id: z.string().min(1), patientId: z.string().min(1), payerId: z.string().min(1), payerName: z.string().min(1), memberId: z.string().min(1), groupNumber: z.string().optional(), planType: z.enum(["HMO", "PPO", "EPO", "POS", "Medicare", "Medicaid", "Commercial", "SelfPay", "Other"]).optional(), priority: z.enum(["primary", "secondary", "tertiary"]), subscriberRelationship: z.enum(["self", "spouse", "child", "other"]), subscriberFirstName: z.string().optional(), subscriberLastName: z.string().optional(), subscriberDob: isoDate.optional(), effectiveDate: isoDate.optional(), terminationDate: isoDate.optional(), timelyFilingDays: z.number().int().positive().optional() });
// CPT/HCPCS codes and modifiers are canonically upper-case; several scrubber rules and the
// 837P/CMS-1500 mapping compare or emit `line.cpt`/`line.modifiers` case-sensitively, so a
// lower-case value accepted here could silently bypass E/M, duplicate, or telehealth edits and
// go out in a non-canonical form. Normalize at this schema boundary rather than patching every
// downstream comparison site.
const lineSchema = z.object({ id: z.string().optional(), cpt: z.string().min(4).max(7).transform((v) => v.toUpperCase()), description: z.string().optional(), modifiers: z.array(z.string()).default([]).transform((mods) => mods.map((m) => m.toUpperCase())), units: z.number().positive().default(1), charge: z.number().nonnegative(), dxPointers: z.array(z.number().int()).default([1]), dateOfService: isoDate, placeOfService: z.string().default("11"), renderingNpi: z.string().optional(), ndc: z.string().optional() });
const dxSchema = z.object({ code: z.string().min(3), description: z.string().optional(), hcc: z.boolean().optional() });

// ---------- Demo / health ----------
rcmRouter.get("/health", (_req, res) => res.json({ success: true, module: "rcm", aiEnabled: (process.env.RCM_AI_ENABLED ?? "false") === "true", vendors: { eligibility: "stub", clearinghouse: "stub" }, agents: agentRuntime.list().map((a) => a.name) }));
rcmRouter.post("/demo/seed", wrap(async (req, res) => {
  // Resets and reseeds the tenant's whole RCM partition — destructive in any environment, not
  // just production (staging/demo deployments hold real-looking financial state too), so this
  // always requires admin rather than gating only on NODE_ENV.
  if ((req as AuthedRequest).userRole !== "admin") return fail(res, 403, "Demo seeding requires an admin role");
  // This deletes every patient, claim, ledger entry, denial, and approval this account has ever
  // recorded before reseeding — an explicit confirmation flag is required so a stray retry,
  // scripted call, or CSRF-less replay can't wipe real data with a bare POST.
  if (req.body?.confirm !== true) return fail(res, 400, 'Resend with { "confirm": true } to acknowledge this permanently deletes all existing RCM data for this account before reseeding demo data');
  const t = tenantOf(req);
  if (demoSeedInFlight.has(t)) return fail(res, 409, "A demo reseed is already in progress for this account — wait for it to finish");
  demoSeedInFlight.add(t);
  try {
    // Setting demoSeedInFlight above stops any NEW mutation from being admitted by the middleware,
    // but a request already admitted before that point (past the check, suspended at its own
    // `await`) is still running and could write into the tenant after reset() — wait for every
    // already-admitted mutation to actually finish before touching the store.
    while ((tenantMutationsInFlight.get(t) ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, 10));
    rcmStore.reset(t);
    const r = await seedDemoTenant(rcmStore, t);
    res.json({ success: true, ...r });
  } finally {
    demoSeedInFlight.delete(t);
  }
}));

// ---------- Patients & coverage ----------
rcmRouter.post("/patients", wrap(async (req, res) => { const p = patientSchema.safeParse(req.body); if (!p.success) return bad(res, p.error); res.json({ success: true, patient: await rcmStore.upsertPatient(tenantOf(req), p.data) }); }));
rcmRouter.get("/patients", wrap(async (req, res) => res.json({ success: true, patients: await rcmStore.listPatients(tenantOf(req)) })));
rcmRouter.post("/coverage", wrap(async (req, res) => { const p = coverageSchema.safeParse(req.body); if (!p.success) return bad(res, p.error); res.json({ success: true, coverage: await rcmStore.upsertCoverage(tenantOf(req), p.data) }); }));
rcmRouter.get("/patients/:id/coverage", wrap(async (req, res) => res.json({ success: true, coverages: await rcmStore.coveragesForPatient(tenantOf(req), req.params.id) })));

// ---------- Eligibility & clearance ----------
rcmRouter.post("/eligibility/check", wrap(async (req, res) => {
  const p = z.object({ coverageId: z.string(), dateOfService: isoDate.default(todayIso()), providerNpi: z.string().default("1234567893"), plannedLines: z.array(z.object({ cpt: z.string(), units: z.number().default(1) })).default([{ cpt: "99213", units: 1 }]), payerResponse: z.unknown().optional() }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const t = tenantOf(req);
  const coverage = await rcmStore.getCoverage(t, p.data.coverageId);
  if (!coverage) return fail(res, 404, "coverage not found");
  const patient = await rcmStore.getPatient(t, coverage.patientId);
  if (!patient) return fail(res, 404, "patient not found");
  // payerResponse lets a caller supply a 271 payload directly instead of going through
  // checkEligibility — with no real vendor behind either path today, that's indistinguishable
  // from any authenticated provider/clinician fabricating "active" benefits (e.g. { eligible: "1"
  // }) and having it persisted with source: "clearinghouse" as if a real payer said so, clearing
  // financial responsibility on data nobody verified. Restrict the override to admin, the same
  // boundary already used for other caller-supplied-truth risks on this router (/ledger's direct
  // insurance-side entries, /remittance/post).
  if (p.data.payerResponse !== undefined && (req as AuthedRequest).userRole !== "admin") return fail(res, 403, "Supplying a payer response directly requires an admin role");
  // A supplied payerResponse must not bypass the local coverage safeguards (effective/
  // termination date, self-pay) that checkEligibility applies — otherwise an arbitrary request
  // body could be stored as "active" benefits for coverage that was never actually in force.
  const coverageInactive = (coverage.effectiveDate && p.data.dateOfService < coverage.effectiveDate) || (coverage.terminationDate && coverage.terminationDate < p.data.dateOfService) || coverage.planType === "SelfPay";
  const benefits = coverageInactive
    ? { active: false, planName: coverage.planType, checkedAt: new Date().toISOString(), source: "manual" as const }
    : p.data.payerResponse ? parse271(p.data.payerResponse) : await checkEligibility({ patient, coverage, dateOfService: p.data.dateOfService, providerNpi: p.data.providerNpi });
  await rcmStore.setBenefits(t, coverage.id, benefits);
  const contract = await rcmStore.getContract(t, coverage.payerId);
  // Build the per-CPT rate from the contract's own pricing (explicit fee schedule, else
  // pctOfMedicare) rather than passing the fee schedule alone — a %-of-Medicare contract like
  // BCBS at 135% has an empty fee schedule, which would silently fall back to the raw
  // Medicare reference rate and under-collect at check-in.
  const contractRates = contract ? Object.fromEntries(p.data.plannedLines.map((l) => [l.cpt, expectedAllowed(contract, l.cpt)])) : undefined;
  const estimate = estimatePatientResponsibility(p.data.plannedLines, benefits, contractRates);
  const discrepancies = detectDiscrepancies({ firstName: patient.firstName, lastName: patient.lastName, dob: patient.dob, memberId: coverage.memberId }, benefits.payerSubscriber ?? {});
  const needAuth = p.data.plannedLines.some((l) => requiresPriorAuth(l.cpt, contract).required);
  const auths = await rcmStore.listAuths(t, patient.id);
  // Scope the match to this coverage/payer — an approved auth from a different plan for the
  // same patient and CPT must not clear this coverage's authorization requirement.
  const authOnFile = p.data.plannedLines.every((l) => !requiresPriorAuth(l.cpt, contract).required || auths.some((a) => a.coverageId === coverage.id && a.payerId === coverage.payerId && authCoversService(a, l.cpt, p.data.dateOfService, l.units).ok));
  const clearance = financialClearance(benefits, estimate, discrepancies, { requiresAuth: needAuth, authOnFile });
  res.json({ success: true, benefits, estimate, discrepancies, clearance });
}));

// ---------- Prior auth ----------
rcmRouter.get("/prior-auth/rules", (_req, res) => res.json({ success: true, rules: DEFAULT_AUTH_RULES }));
rcmRouter.get("/prior-auth", wrap(async (req, res) => res.json({ success: true, auths: await rcmStore.listAuths(tenantOf(req), typeof req.query.patientId === "string" ? req.query.patientId : undefined) })));
rcmRouter.post("/prior-auth", wrap(async (req, res) => {
  const p = z.object({ patientId: z.string(), coverageId: z.string(), payerId: z.string(), cpt: z.string(), diagnoses: z.array(z.string()).default([]), dateOfService: isoDate.optional(), units: z.number().int().positive().optional(), urgency: z.enum(["standard", "urgent"]).optional(), availableDocs: z.array(z.string()).optional(), submit: z.boolean().default(false) }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const t = tenantOf(req);
  // Independently-supplied ids must actually belong together — otherwise this can persist an
  // authorization record for the wrong patient/coverage/payer combination, which the scrubber
  // later trusts when clearing auth-missing.
  const patient = await rcmStore.getPatient(t, p.data.patientId);
  const coverage = await rcmStore.getCoverage(t, p.data.coverageId);
  if (!patient || !coverage) return fail(res, 404, "patient or coverage not found");
  if (coverage.patientId !== patient.id) return fail(res, 400, "coverage does not belong to this patient");
  if (coverage.payerId !== p.data.payerId) return fail(res, 400, "payerId does not match this coverage");
  let auth = createAuthRequest(p.data);
  if (p.data.submit) auth = transitionAuth(auth, "requested", { actor: actorOf(req) });
  res.json({ success: true, auth: await rcmStore.upsertAuth(t, auth) });
}));
rcmRouter.post("/prior-auth/:id/transition", wrap(async (req, res) => {
  const p = z.object({ to: z.enum(["not-required", "required", "requested", "pended", "approved", "denied", "expired", "exhausted"]), note: z.string().optional(), authNumber: z.string().optional(), validFrom: isoDate.optional(), validTo: isoDate.optional(), approvedUnits: z.number().int().positive().optional() }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const t = tenantOf(req);
  // This stub environment has no real payer/278-response integration behind "approved" — the
  // caller supplies authNumber/validFrom/validTo by hand. Nothing here can actually verify those
  // came from the payer, so at minimum restrict who can fabricate an approval to admins, the same
  // trust boundary already applied to other financially/clinically consequential direct writes.
  if (p.data.to === "approved" && (req as AuthedRequest).userRole !== "admin") return fail(res, 403, "Transitioning a prior auth to approved requires an admin role");
  if (!(await rcmStore.getAuth(t, req.params.id))) return fail(res, 404, "auth not found");
  // A submit-claim run holds this same lock from its own re-validation through final unit
  // consumption — changing the auth's status mid-flight (expire/exhaust/deny) is exactly the race
  // that validation is there to prevent. This is only a check, not a real lock acquisition (this
  // route makes no competing claim on the auth, so there's nothing of its own to hold the lock
  // for) — a submission could still start during this check's own `getAuth` await. Re-fetch and
  // re-check again immediately below, in the same synchronous stretch as the write itself, rather
  // than reusing the auth object fetched for the 404 check above: that narrows (though, without a
  // real store transaction, can't fully close) the window where this could silently overwrite a
  // submission's just-consumed unitsUsed/status with stale data.
  if (isAuthSubmitLocked(t, req.params.id)) return fail(res, 409, "This authorization is currently being consumed by an in-flight claim submission — retry shortly");
  const auth = await rcmStore.getAuth(t, req.params.id);
  if (!auth) return fail(res, 404, "auth not found");
  if (isAuthSubmitLocked(t, req.params.id)) return fail(res, 409, "This authorization is currently being consumed by an in-flight claim submission — retry shortly");
  try { res.json({ success: true, auth: await rcmStore.upsertAuth(t, transitionAuth(auth, p.data.to as AuthStatus, { actor: actorOf(req), ...p.data })) }); } catch (e) { fail(res, 409, e instanceof Error ? e.message : "illegal transition"); }
}));

// ---------- Charge capture & coding ----------
rcmRouter.get("/charge-master", (_req, res) => res.json({ success: true, catalog: chargeMasterCatalog() }));
rcmRouter.post("/charges/derive", wrap(async (req, res) => {
  const p = z.object({ encounterId: z.string(), patientId: z.string(), dateOfService: isoDate, placeOfService: z.string().default("11"), renderingNpi: z.string(), newPatient: z.boolean().default(false), telehealth: z.boolean().optional(), emLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(), proceduresDocumented: z.array(z.string()).default([]), ordersCompleted: z.array(z.string()).default([]), vaccinesGiven: z.number().int().nonnegative().default(0), diagnoses: z.array(dxSchema).default([]), visitComplexityAddOn: z.boolean().optional(), enteredAt: isoDate.optional() }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const lines = deriveCharges(p.data);
  const gaps = detectChargeGaps(p.data, lines, { enteredAt: p.data.enteredAt });
  if (p.data.enteredAt) await rcmStore.recordChargeLag(tenantOf(req), daysBetween(p.data.dateOfService, p.data.enteredAt));
  res.json({ success: true, lines, gaps, total: lines.reduce((s, l) => s + l.charge, 0) });
}));
rcmRouter.post("/charges/voice", wrap(async (req, res) => {
  const p = z.object({ transcript: z.string().min(1), dateOfService: isoDate.default(todayIso()), placeOfService: z.string().default("11"), renderingNpi: z.string().default("1234567893"), diagnoses: z.array(dxSchema).default([]), telehealth: z.boolean().optional() }).safeParse(req.body);
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
  if (coverage.patientId !== patient.id) return fail(res, 400, "coverage does not belong to this patient");
  const contract = await rcmStore.getContract(t, coverage.payerId);
  const claim = buildClaim({ ...p.data, patient, coverage, diagnoses: p.data.diagnoses as Diagnosis[], lines: p.data.lines as ServiceLine[], contractTimelyFilingDays: contract?.timelyFilingDays });
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
  // The full payer-aware auth requirement (contract list + DEFAULT_AUTH_RULES + gold-carding),
  // not just the contract's own explicit list — a contract with no explicit list (e.g. the
  // default Medicare contract) can still have default-rule codes like 72148 that need auth.
  const authRequiredCpts = claim.lines.filter((l) => requiresPriorAuth(l.cpt, contract).required).map((l) => l.cpt);
  const auths = await rcmStore.listAuths(t);
  const authorizedCpts = authorizedCptsOnFile(claim.priorAuthNumber, claim.patientId, claim.coverageId, claim.payerId, claim.lines, auths);
  const ctx = { patient, coverage, authRequiredCpts, authorizedCpts, priorClaimsSameDos: others };
  const result = scrubClaim(claim, ctx);
  await rcmStore.recordScrub(t, result.clean);
  // Auto-fixes rewrite claim data (modifiers, totals) — only safe to persist while the claim is
  // still pre-submission. A submitted/adjudicated/paid claim must go through a corrected claim
  // (frequency 7/8) instead of having its historical bill silently rewritten.
  const applyFixes = req.body?.applyAutoFixes === true && ["draft", "scrubbed", "ready"].includes(claim.status);
  let next = claim;
  let applied: string[] = [];
  let finalResult = result;
  if (applyFixes) { const f = applyAutoFixes(claim, result.edits); next = f.claim; applied = f.applied; finalResult = scrubClaim(next, ctx); }
  if (next.status === "draft") next = transitionClaim(next, "scrubbed", actorOf(req), `score ${finalResult.score}`);
  if (finalResult.clean && next.status === "scrubbed") next = transitionClaim(next, "ready", actorOf(req), "clean");
  // A "ready" claim can be dirtied by edits made after it was last marked clean (e.g. a
  // corrected-claim line change) — a re-scrub that finds new errors must demote it back to
  // "scrubbed" rather than leaving it falsely staged for submission.
  if (!finalResult.clean && next.status === "ready") next = transitionClaim(next, "scrubbed", actorOf(req), `re-scrub found ${finalResult.errors.length} error(s)`);
  await rcmStore.upsertClaim(t, next);
  if (!finalResult.clean && !(await rcmStore.findOpenWorkItem(t, (w) => w.queue === "claim-edits" && w.claimId === next.id))) {
    await rcmStore.addWorkItems(t, itemsFromScrub(next, finalResult.errors.length));
  }
  res.json({ success: true, result: finalResult, applied, claim: next });
}));
// Edit a pre-submission claim's billed data in place (diagnoses/lines/auth/POS) — the only way
// to actually resolve a "claim-edits" work item, whether it came from an ordinary failed scrub
// or from file-corrected-claim staging an unpatched clone of a denied claim. A submitted/
// adjudicated/paid claim's historical bill must go through a corrected claim (frequency 7/8)
// instead, same boundary applyAutoFixes' own persistence check already enforces.
rcmRouter.patch("/claims/:id", wrap(async (req, res) => {
  const p = z.object({ diagnoses: z.array(dxSchema).optional(), lines: z.array(lineSchema).optional(), priorAuthNumber: z.string().optional(), referralNumber: z.string().optional(), placeOfService: z.string().optional() }).safeParse(req.body ?? {});
  if (!p.success) return bad(res, p.error);
  const t = tenantOf(req);
  const c = await rcmStore.getClaim(t, req.params.id);
  if (!c) return fail(res, 404, "claim not found");
  if (c.status !== "draft" && c.status !== "scrubbed") return fail(res, 409, `Cannot edit billed data on a claim in status "${c.status}" directly — file a corrected claim instead`);
  const next = applyClaimPatch(c, { diagnoses: p.data.diagnoses as Diagnosis[] | undefined, lines: p.data.lines as ServiceLine[] | undefined, priorAuthNumber: p.data.priorAuthNumber, referralNumber: p.data.referralNumber, placeOfService: p.data.placeOfService });
  res.json({ success: true, claim: await rcmStore.upsertClaim(t, next) });
}));
// Manual/staging transitions only — anything that finalizes a payer-facing state (submitted
// and beyond) must go through the approval-gated submit-claim tool or an actual ERA posting,
// never a direct call to this endpoint, or a caller could fabricate an adjudication outcome or
// skip the submission approval entirely. "ready" is excluded too: it must only be reached by an
// actual clean scrub (POST /claims/:id/scrub or the scrub-claim agent tool), since submit-claim
// trusts "ready" without re-scrubbing — a direct transition here would let a dirty claim skip
// scrubbing entirely. "rejected" is a real clearinghouse/payer outcome like denied/paid/
// adjudicated, not something for a human to set by hand.
const directClaimTransitions = new Set<Claim["status"]>(["draft", "scrubbed", "closed"]);
rcmRouter.post("/claims/:id/transition", wrap(async (req, res) => {
  const p = z.object({ to: z.string(), note: z.string().optional() }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  if (!directClaimTransitions.has(p.data.to as Claim["status"])) return fail(res, 403, `"${p.data.to}" can only be reached via claim submission or remittance posting, not a direct transition`);
  const t = tenantOf(req);
  const claim = await rcmStore.getClaim(t, req.params.id);
  if (!claim) return fail(res, 404, "claim not found");
  // "closed" is reachable (per the state machine) from denied/appealed/paid/partially-paid as
  // well as pre-submission states — but closing directly out of an unresolved denial or appeal
  // would hide an unpaid claim without ever going through write-off, a corrected claim, or a
  // recorded payer outcome. Block that specific path; every other "closed" target stays direct.
  if (p.data.to === "closed" && (claim.status === "denied" || claim.status === "appealed")) return fail(res, 409, `Cannot close a claim directly out of "${claim.status}" — resolve it via write-off, a corrected claim, or the denial's actual payer outcome first`);
  // The state machine legally allows denied -> draft (distinct from "rejected", the front-end/
  // clearinghouse-level rejection that's meant to be fixed and resubmitted this way) — but a
  // claim that was actually ADJUDICATED denied and reset to draft here would then flow through
  // the normal draft -> scrubbed -> ready -> submitted pipeline as if it were a brand-new original
  // claim, silently bypassing the frequency-7 corrected-claim workflow (and its
  // correctableClaimStatuses guard above) that a real payer-adjudicated denial requires.
  if (p.data.to === "draft" && correctableClaimStatuses.has(claim.status)) return fail(res, 409, `Cannot reset "${claim.status}" directly to draft — file a corrected claim (POST /claims/:id/corrected) instead of resubmitting it as a new original`);
  try { res.json({ success: true, claim: await rcmStore.upsertClaim(t, transitionClaim(claim, p.data.to as Claim["status"], actorOf(req), p.data.note)) }); } catch (e) { fail(res, 409, e instanceof Error ? e.message : "illegal transition"); }
}));
rcmRouter.get("/claims/:id/837p", wrap(async (req, res) => {
  const t = tenantOf(req);
  const c = await rcmStore.getClaim(t, req.params.id);
  if (!c) return fail(res, 404, "claim not found");
  const p = await rcmStore.getPatient(t, c.patientId);
  const cov = await rcmStore.getCoverage(t, c.coverageId);
  if (!p || !cov) return fail(res, 404, "patient/coverage missing");
  // /coverage can upsert (replace) an existing record by id — if the coverage this claim points
  // to was since replaced with a different patient's or payer's data, mapping it here without
  // this check would emit an 837P/CMS-1500 mixing this claim's patientId/payerId with another
  // patient's subscriber data or another payer's member data.
  if (cov.patientId !== c.patientId || cov.payerId !== c.payerId) return fail(res, 409, "coverage on file no longer matches this claim's patient/payer — re-verify before exporting");
  // "draft"/"scrubbed" haven't passed (or haven't yet passed clean) the scrub pass submit-claim
  // requires — exporting a real, downloadable 837P/CMS-1500 for one would let a caller manually
  // send a claim that bypassed the clean-scrub and approval gates entirely.
  if (c.status === "draft" || c.status === "scrubbed") return fail(res, 409, `Claim ${c.id} hasn't passed scrubbing yet (status: ${c.status}) — it isn't payer-ready to export`);
  // "ready" is the one status this endpoint allows through that has NOT yet passed through the
  // approval-gated submit-claim tool (every other non-draft/non-scrubbed/non-"ready" status is
  // only reachable by having already gone through it, or through an ERA posting — see
  // directClaimTransitions/correctableClaimStatuses' own comments). The 837P here is the actual
  // X12 electronic-submission payload (unlike the CMS-1500 boxes, which exist to support a
  // legitimate PAPER workflow) — letting any provider/clinician download it for a claim that
  // hasn't been approved to submit would let them feed it to a clearinghouse themselves, achieving
  // exactly what the admin-gated submit-claim approval exists to prevent. Restrict to admin only
  // for this one pre-submission case; every other status stays open to the wider role set since
  // exporting it isn't a submission-approval bypass — the claim already went through the gate.
  if (c.status === "ready" && (req as AuthedRequest).userRole !== "admin") return fail(res, 403, "Exporting a not-yet-submitted claim's payer-ready payload requires an admin role — approve and submit it instead, or have an admin export it for a paper workflow");
  // "closed" is reachable directly from "draft"/"scrubbed" too (an abandoned/voided claim that
  // never actually passed scrubbing) — every OTHER non-draft/non-scrubbed status is only
  // reachable via "ready" (see TRANSITIONS in claims.ts), so "closed" is the one case that needs
  // its own check: did this claim's history ever actually record reaching "ready"?
  if (c.status === "closed" && !c.history.some((h) => h.status === "ready")) return fail(res, 409, `Claim ${c.id} was closed before ever passing a clean scrub — nothing payer-ready to export`);
  res.json({ success: true, x12: claimTo837P(c, p, cov), cms1500: claimToCms1500Boxes(c, p, cov) });
}));
// Frequency-7 (replacement)/8 (void) only make sense once the original actually reached the
// payer — that's the entire premise of "correcting"/"voiding" a prior submission. A claim still
// pre-submission (draft/scrubbed/ready) or front-end-rejected (never accepted into adjudication,
// and the state machine already routes it back to draft for a fresh resubmission, not a
// replacement) has nothing to correct yet: cloning it here creates a second, independently
// submit-able claim object that the scrubber's duplicate-service check intentionally excludes
// from flagging against its original, so both could be billed.
const correctableClaimStatuses = new Set<Claim["status"]>(["submitted", "acknowledged", "pended", "adjudicated", "paid", "partially-paid", "denied", "appealed"]);
rcmRouter.post("/claims/:id/corrected", wrap(async (req, res) => {
  const p = z.object({ kind: z.enum(["7", "8"]).default("7"), diagnoses: z.array(dxSchema).optional(), lines: z.array(lineSchema).optional(), priorAuthNumber: z.string().optional() }).safeParse(req.body ?? {});
  if (!p.success) return bad(res, p.error);
  const t = tenantOf(req);
  const c = await rcmStore.getClaim(t, req.params.id);
  if (!c) return fail(res, 404, "claim not found");
  if (!correctableClaimStatuses.has(c.status)) return fail(res, 409, `Cannot create a corrected/void claim from status "${c.status}" — the original hasn't reached the payer yet (or was front-end rejected); edit or resubmit it directly instead`);
  const next = correctedClaim(c, { diagnoses: p.data.diagnoses as Diagnosis[] | undefined, lines: p.data.lines as ServiceLine[] | undefined, priorAuthNumber: p.data.priorAuthNumber }, p.data.kind);
  res.json({ success: true, claim: await rcmStore.upsertClaim(t, next) });
}));
// A secondary/COB claim carries the PRIMARY payer's actual adjudication outcome (paid,
// patient responsibility, adjustments) to the secondary payer — that outcome can't exist before
// the primary claim has actually been adjudicated. Without this, any authenticated caller could
// fabricate primaryRemit data for a claim still sitting in draft/submitted and send it to the
// secondary payer as if the primary had already responded.
// "appealed" is only reachable from paid/partially-paid/denied (see TRANSITIONS in claims.ts) —
// a claim sitting there already has a real primary EOB behind it, same as correctableClaimStatuses
// already treats it. Omitting it would block a legitimate secondary/COB claim the moment the
// primary appeal is filed, even though nothing about the primary's adjudication changed.
const primaryAdjudicatedStatuses = new Set<Claim["status"]>(["adjudicated", "paid", "partially-paid", "denied", "appealed"]);
rcmRouter.post("/claims/:id/secondary", wrap(async (req, res) => {
  const p = z.object({ secondaryCoverageId: z.string() }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const t = tenantOf(req);
  const c = await rcmStore.getClaim(t, req.params.id);
  const cov = await rcmStore.getCoverage(t, p.data.secondaryCoverageId);
  if (!c || !cov) return fail(res, 404, "claim or coverage not found");
  if (cov.patientId !== c.patientId) return fail(res, 400, "coverage does not belong to this claim's patient");
  if (cov.priority === "primary") return fail(res, 400, "secondary claim requires a non-primary coverage");
  // A COB claim only makes sense as "what the PRIMARY payer already adjudicated, forwarded to a
  // secondary payer" — without these two checks, a claim whose own coverage isn't actually primary
  // (or was changed since), or a target coverage that's the same record as the claim's own, could
  // be passed off as a legitimate secondary/COB claim with no real primary-adjudication
  // relationship behind it.
  if (p.data.secondaryCoverageId === c.coverageId) return fail(res, 400, "secondary coverage must be different from the claim's own coverage");
  const sourceCov = await rcmStore.getCoverage(t, c.coverageId);
  if (!sourceCov || sourceCov.priority !== "primary") return fail(res, 400, "this claim's own coverage is no longer on file as primary — a secondary/COB claim can only be filed from a primary claim");
  if (!primaryAdjudicatedStatuses.has(c.status)) return fail(res, 409, `Cannot create a secondary/COB claim from status "${c.status}" — the primary payer hasn't adjudicated this claim yet`);
  // Derive the COB summary from the claim's own posted LEDGER entries — the actual record of what
  // was applied — rather than a caller-supplied figure or the stored remittance's raw CLP rows.
  // A Remittance can carry `postedAt` at the whole-ERA level while individual claim rows inside it
  // were skipped into needsReconciliation (a duplicate/unmatched/illegal-transition row never
  // reaches postLedger) — netting those raw rows can pull in a payment that never actually landed
  // on this claim. The ledger has no such ambiguity: postLedger is only ever called for rows that
  // weren't skipped, and it's also naturally net across however many remittances (reversal-and-
  // correction pairs, partial/installment payments) touched this claim.
  //
  // A pure denial (no CO-45/253 contractual write-off, zero paid, zero patient responsibility)
  // legitimately posts NO ledger entries at all — denial CARCs go to Denial records, not the
  // ledger — so an empty claimLedger here is not itself evidence that nothing was ever posted;
  // primaryAdjudicatedStatuses already confirms the claim was actually adjudicated, and
  // cobPrimaryPaid: 0 is the correct outcome to send in that case.
  const claimLedger = (await rcmStore.ledger(t, c.patientId)).filter((e) => e.claimId === c.id);
  const netPaid = round2(sum(claimLedger.filter((e) => e.type === "insurance-payment").map((e) => e.amount)) - sum(claimLedger.filter((e) => e.type === "refund" && e.responsibleParty === "insurance").map((e) => e.amount)));
  const netPatientResp = round2(sum(claimLedger.filter((e) => e.type === "transfer-to-patient").map((e) => e.amount)));
  res.json({ success: true, claim: await rcmStore.upsertClaim(t, secondaryClaim(c, cov, { billed: c.totalCharge, paid: netPaid, patientResp: netPatientResp, lines: [] })) });
}));

// ---------- Remittance ----------
rcmRouter.post("/remittance/post", wrap(async (req, res) => {
  // This route posts exactly the insurance-side ledger entry types (insurance-payment,
  // contractual-adjustment, transfer-to-patient) that /ledger above restricts to admin, plus
  // moves claims to paid/denied and creates denial records — all from a caller-supplied ERA
  // payload with no payer/channel authentication behind it (parseEra accepts arbitrary JSON from
  // a stub clearinghouse). Leaving this open to the wider provider/clinician role set would let a
  // clinician fabricate an ERA to inject insurance cash or mark claims paid/denied, bypassing the
  // same admin-only money-posting control /ledger already enforces for these entry types.
  if ((req as AuthedRequest).userRole !== "admin") return fail(res, 403, "Posting a remittance requires an admin role");
  const t = tenantOf(req);
  const rem = parseEra(req.body?.era ?? req.body);
  // parseEra tolerates arbitrary/malformed JSON by normalizing missing fields to empty defaults
  // (claims: [], checkAmount: 0) rather than throwing — appropriate for a lenient vendor-field
  // parser, but this route must not then persist that as a successfully posted, fully-reconciled
  // ($0, balanced) remittance. Reject a payload with no claim rows before doing any work.
  if (!rem.claims.length) return fail(res, 400, "ERA has no claim rows to post — check the uploaded payload");
  // Idempotency: a clearinghouse retry or a duplicate click must not double-post the same ERA.
  // Identify it by payer + check number (the standard 835 trace key, meant to be unique per
  // actual payment/EFT a payer issues) when present, otherwise by its own id (explicit, or a
  // content fingerprint — see parseEra). The LOCK key deliberately excludes checkAmount — see the
  // `alreadyPosted` check below for why amount is excluded there too, for the same reason.
  const identityKey = rem.checkNumber ? `cn:${rem.payerId ?? ""}:${rem.checkNumber}` : `id:${rem.id}`;
  const lockKey = `${t}:${identityKey}`;
  // Synchronous check-and-set, before any `await` — see remittancePostInFlight's comment.
  if (remittancePostInFlight.has(lockKey)) return fail(res, 409, "This remittance is already being posted");
  remittancePostInFlight.add(lockKey);
  // Populated once this remittance's affected patients are known (below), and released in the
  // `finally` alongside remittancePostInFlight — declared here so an early return before that
  // point still hits a defined, empty array.
  let patientLockKeys: string[] = [];
  try {
    const alreadyPosted = (await rcmStore.listRemittances(t)).some((r) =>
      r.id === rem.id ||
      // checkAmount is deliberately NOT part of this comparison. An earlier version of this
      // check required it to match too, on the theory that a corrected resend could legitimately
      // carry the same trace number with a different amount — but a genuine correction to an
      // already-posted payment is represented as its own NEW remittance (a reversal row, CLP02
      // "22", followed by the corrected re-adjudication; the claim state machine's
      // "adjudicated"/"partially-paid" self-transitions exist specifically to let that pair
      // post), never as a resend of the SAME trace number with a merely different amount. Trusting
      // a changed amount as proof of a legitimate correction let a replay under the identical
      // trace number slip straight past this check as an ordinary new remittance — and since the
      // claim state machine tolerates repeat adjudication transitions, that could double-post
      // cash for the same underlying payment. A payer trace/EFT number is specified to be unique
      // per transaction; treating any resend of it as the same remittance regardless of amount is
      // the correct read of that identity, not an overly strict one.
      (!!rem.checkNumber && r.checkNumber === rem.checkNumber && r.payerId === rem.payerId) ||
      // Covers the case the check above can't: a resend that arrives under a brand-new id AND
      // check number (a vendor trace-number bug, or a clearinghouse that mints a fresh id per
      // delivery attempt) while still carrying byte-identical adjudication data for the same
      // payer/check-date/check-amount — e.g. a duplicate reversal that would otherwise slip past
      // the id/check-number comparison above and post a second refund/adjustment. Requiring the
      // full claim-level content signature to match too (not just payer/amount/date) keeps this
      // from false-positiving on two genuinely distinct
      // remittances that happen to share a payer, date, and total.
      (!!rem.payerId && r.payerId === rem.payerId && r.checkAmount === rem.checkAmount && r.checkDate === rem.checkDate && claimContentSignature(r.claims) === claimContentSignature(rem.claims)));
    if (alreadyPosted) return fail(res, 409, "This remittance has already been posted (duplicate ERA id/check number)");
    const claimsById = await rcmStore.claimsById(t);
    const contracts = await rcmStore.contracts(t);
    const result = postRemittance(rem, claimsById, contracts);
    // A negative unapplied means the ERA's claim rows sum to MORE than the check itself covers
    // (e.g. a $150 claim payment inside a $100 check) — internally inconsistent, and posting it
    // anyway would inject more cash into the ledger than this remittance actually carried. Nothing
    // has been written yet at this point (postRemittance is pure), so reject the whole payload
    // before any postLedger/upsertClaim call rather than posting it and merely reporting
    // `balanced: false` after the fact.
    if (result.unapplied < -0.01) return fail(res, 400, `ERA claim rows total $${(-result.unapplied).toFixed(2)} more than the check amount ($${rem.checkAmount.toFixed(2)}) accounts for — reject and re-verify the payload before posting`);
    // Every entry this remittance is about to post carries the patientId it affects — take the
    // same shared patientLedgerLocks lock the issue-refund/small-balance-write-off agent tools and
    // the direct POST /ledger route use, for every patient this ERA touches, before posting any of
    // it. Otherwise a refund or write-off approved concurrently for one of these patients could
    // read its balance before this remittance's cash lands, and cap itself against a balance
    // that's about to change out from under it. See patientLedgerLocks' comment in
    // patient-financials.ts.
    // Computed into a local first, not the outer `patientLockKeys` — the `finally` below deletes
    // whatever `patientLockKeys` holds, so assigning the full candidate list before the conflict
    // check would make an early return here delete keys this request never actually added,
    // releasing a lock a concurrent refund/write-off/other post still legitimately holds.
    const candidateLockKeys = Array.from(new Set(result.postings.flatMap((p) => p.entries.map((e) => `${t}:${e.patientId}`))));
    const lockedPatient = candidateLockKeys.find((k) => patientLedgerLocks.has(k));
    if (lockedPatient) return fail(res, 409, "A refund, write-off, or another ledger post for one of this remittance's patients is already in flight — retry shortly");
    patientLockKeys = candidateLockKeys;
    patientLockKeys.forEach((k) => patientLedgerLocks.add(k));
    const created: string[] = [];
    const needsReconciliation: string[] = [];
    let skippedCash = 0;
    for (const p of result.postings) {
      // "unmatched" (unknown claim id, payer mismatch, or a duplicate row within this same batch)
      // means postRemittance could not identify a claim to post against at all — it already
      // leaves `entries` empty and excludes the row from `applied`, so a nonzero payment already
      // surfaces as a nonzero `unapplied` (forcing `balanced: false`). But a $0 unmatched row (a
      // zero-pay denial for a claim id we don't recognize, say) moves neither `applied` nor
      // `unapplied`, so without flagging it explicitly here the whole ERA could come back
      // `balanced: true` with no record that a row was never actually reconciled to anything.
      // Flag every unmatched row regardless of dollar amount, same as the illegal-transition case
      // below, and skip straight to the next posting — there's no claim to look up or transition.
      if (p.status === "unmatched") { needsReconciliation.push(p.claimId ?? "(unrecognized claim id)"); continue; }
      const claim = p.claimId ? claimsById[p.claimId] : undefined;
      const to = claim ? claimStatusFromPosting(p) : undefined;
      // "adjudicated" (like "partially-paid") is allowed to self-transition — both a reversal and
      // a zero-pay posting map to "adjudicated", so a same-ERA reversal-then-correction pair needs
      // it, and so does a legitimate LATER, separate ERA that finally re-adjudicates a previously
      // reversed claim as zero-pay. Round 34 tried to restrict this self-transition to same-request
      // postings only, to close a narrow gap (a duplicate ERA resent under a different check number
      // hitting an already-adjudicated claim); that traded a rare edge case for a much more common
      // failure — it also silently blocked every legitimate cross-request zero-pay re-adjudication,
      // with no retry path once flagged into needsReconciliation (see the still-open ERA-replay gap
      // noted elsewhere on this PR). Reverted. The narrow duplicate-under-a-different-check-number
      // risk this reopens is now caught upstream instead: the `alreadyPosted` check above also
      // compares claim-content signatures (see claimContentSignature), so a resend with byte-
      // identical adjudication data under a new id/check number is rejected before this loop ever
      // runs, rather than relying on this self-transition restriction to guard against it.
      if (claim && to && !canTransition(claim.status, to)) {
        // A duplicate or erroneous ERA that slipped past the id/check-number idempotency check
        // above (e.g. the same payment resent under a different check number) must not silently
        // inject cash into the ledger for a claim that can't legally receive this outcome from
        // its current status — that would double-count money with no corresponding state change.
        // Skip the whole posting; flag it for manual reconciliation instead. The cash this posting
        // would have applied (postRemittance already counted it toward `applied`/`unapplied`) must
        // be added back to `unapplied` and `balanced` forced false, or a duplicate/erroneous ERA
        // that skips every posting would come back reporting a fully reconciled $0 remittance even
        // though none of its money actually landed anywhere.
        needsReconciliation.push(p.claimId!);
        // Match postRemittance's own sign convention for `applied` (a reversal always SUBTRACTS
        // its magnitude, regardless of whether the vendor sent it as an already-negative value or
        // a positive one relying on CLP02 "22" alone) — adding back the raw, possibly-positive
        // `p.paid` here would move `unapplied` in the wrong direction for a skipped reversal.
        skippedCash += p.status === "reversal" ? -Math.abs(p.paid) : p.paid;
        continue;
      }
      await rcmStore.postLedger(t, p.entries);
      if (claim && to) {
        const next = transitionClaim(claim, to, "era-post");
        await rcmStore.upsertClaim(t, next);
        // A reversal-and-correction pair (or any other legitimate multi-row sequence for the same
        // claim) posts as two separate postings within this SAME loop — update the local snapshot
        // so the correction's `canTransition` check above sees the reversal's own status change
        // instead of the claim's pre-ERA status. Without this, e.g. a reversal moving a "paid"
        // claim to "adjudicated" would leave the very next row still reading "paid" from the
        // stale snapshot, and `canTransition("paid", "paid")` is false — the correction skips
        // and gets flagged for reconciliation even though it's exactly what should post.
        claimsById[claim.id] = next;
        const contract = contracts[claim.payerId];
        for (const adj of p.denials) { const d = denialFromAdjustment(claim, adj, { appealDays: contract?.appealDays, receivedAt: rem.receivedAt }); await rcmStore.upsertDenial(t, d); created.push(d.id); }
        if (p.underpayment) await rcmStore.addWorkItems(t, [makeWorkItem({ queue: "underpayments", title: `Underpaid $${p.underpayment.variance.toFixed(2)} vs contract (${claim.payerName})`, patientId: claim.patientId, claimId: claim.id, amount: p.underpayment.variance, priority: 65, source: "system", context: { ...p.underpayment } })]);
      }
    }
    const denials = (await rcmStore.listDenials(t, "open")).filter((d) => created.includes(d.id));
    await rcmStore.addWorkItems(t, itemsFromDenials(denials));
    await rcmStore.addRemittance(t, { ...rem, postedAt: new Date().toISOString() });
    const unapplied = round2(result.unapplied + skippedCash);
    const balanced = needsReconciliation.length === 0 && result.balanced;
    res.json({ success: true, remittance: rem, postings: result.postings, unapplied, balanced, denialsCreated: created, needsReconciliation });
  } finally {
    remittancePostInFlight.delete(lockKey);
    patientLockKeys.forEach((k) => patientLedgerLocks.delete(k));
  }
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
// "written-off", "appealed", and "in-progress" are deliberately excluded: written-off/appealed
// each require matching real work only the approval-gated write-off/send-appeal tools actually do
// (posting the denial-adjustment ledger entry; generating and sending the appeal letter), and
// file-corrected-claim is the only thing that legitimately sets "in-progress" (staging a real
// replacement claim). Allowing any of them to be set directly here would clear the denial from
// the open queue — and out of the denial agent's next `listDenials(..., "open")` scan — while
// skipping that remediation (and, for the approval-gated pair, the approval itself) entirely,
// silently hiding an unresolved receivable indefinitely. "overturned"/"upheld" stay directly
// settable because nothing else in this app can set them: they record the payer's actual decision
// on an appeal that already went out, which arrives outside the system (a letter, a portal, a
// phone call) with no automated signal to gate behind — a human recording a real external
// outcome, not bypassing an approval for one.
rcmRouter.post("/denials/:id/status", wrap(async (req, res) => {
  const p = z.object({ status: z.enum(["open", "overturned", "upheld"]) }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const t = tenantOf(req);
  const d = await rcmStore.getDenial(t, req.params.id);
  if (!d) return fail(res, 404, "denial not found");
  // A payer can only overturn or uphold a denial that was actually appealed to it.
  if ((p.data.status === "overturned" || p.data.status === "upheld") && d.status !== "appealed") return fail(res, 409, `Denial ${d.id} is not in "appealed" status (currently: ${d.status}) — a payer decision only applies to a denial that was actually appealed`);
  // Terminal/resolved statuses (written-off, overturned, upheld) must never be reopened here —
  // this route only validates the destination, so nothing else stopped a caller from posting
  // "open" on an already-resolved denial and letting the denial agent stage a duplicate
  // write-off/transfer/appeal against it.
  const terminal = new Set(["written-off", "overturned", "upheld"]);
  if (p.data.status === "open" && terminal.has(d.status)) return fail(res, 409, `Denial ${d.id} is already resolved (${d.status}) and cannot be reopened`);
  res.json({ success: true, denial: await rcmStore.upsertDenial(t, { ...d, status: p.data.status }) });
}));

// ---------- Patient financials ----------
rcmRouter.get("/patients/:id/account", wrap(async (req, res) => { const t = tenantOf(req); const entries = await rcmStore.ledger(t, req.params.id); res.json({ success: true, summary: computeAccount(req.params.id, entries), aging: computeAging(entries), entries }); }));
rcmRouter.get("/patients/:id/statement", wrap(async (req, res) => { const t = tenantOf(req); const p = await rcmStore.getPatient(t, req.params.id); if (!p) return fail(res, 404, "patient not found"); const cycle = (["1", "2", "3", "final"].includes(String(req.query.cycle)) ? (req.query.cycle === "final" ? "final" : Number(req.query.cycle)) : 1) as 1 | 2 | 3 | "final"; res.json({ success: true, statement: buildStatement(p, await rcmStore.ledger(t, p.id), cycle) }); }));
rcmRouter.post("/patients/:id/propensity", wrap(async (req, res) => { const t = tenantOf(req); const p = await rcmStore.getPatient(t, req.params.id); if (!p) return fail(res, 404, "patient not found"); const s = computeAccount(p.id, await rcmStore.ledger(t, p.id)); const fpl = p.annualHouseholdIncome !== undefined && p.householdSize ? fplPercent(p.annualHouseholdIncome, p.householdSize) : undefined; res.json({ success: true, propensity: propensityToPay({ balance: s.patientBalance, priorStatementsPaidOnTime: req.body?.paidOnTime ?? 0, priorStatementsLate: req.body?.late ?? 0, hasCardOnFile: !!req.body?.hasCardOnFile, fplPct: fpl }), fplPct: fpl, slidingFee: fpl !== undefined ? slidingFeeDiscount(fpl) : undefined }); }));
// Uses the shared paymentPlanLocks lock from patient-financials.ts (also used by the
// offer-payment-plan agent tool) — a lock private to just this route wouldn't serialize against
// that tool creating a plan for the same patient at the same time. Closes the check-then-insert
// TOCTOU below: the balance/active-plan checks and the eventual upsertPaymentPlan are separated
// by `await`s a second concurrent request could slip through, both reading "no active plan" and
// each creating its own schedule against the same balance. ALSO takes the shared patientLedgerLocks
// lock (see its comment in patient-financials.ts) — paymentPlanLocks alone doesn't serialize against
// a concurrent refund/write-off/direct-ledger-post/remittance-post for the same patient, which
// could change the balance this route caps against between the check and the upsert.
rcmRouter.post("/patients/:id/payment-plan", wrap(async (req, res) => {
  const p = z.object({ total: z.number().positive(), months: z.number().int().positive().max(36), startDate: isoDate.optional(), autoPay: z.boolean().default(false) }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const t = tenantOf(req);
  const pt = await rcmStore.getPatient(t, req.params.id);
  if (!pt) return fail(res, 404, "patient not found");
  const lockKey = `${t}:${req.params.id}`;
  if (paymentPlanLocks.has(lockKey)) return fail(res, 409, "A payment plan action for this patient is already in progress — retry shortly");
  // Also take the shared patientLedgerLocks lock (the same one /ledger, /remittance/post, and the
  // refund/write-off agent tools use) — paymentPlanLocks alone only serializes this route against
  // OTHER payment-plan actions, not against a concurrent refund/write-off/direct-ledger-post/
  // remittance-post for the same patient. Without it, the balance this route reads below could
  // change out from under it between the check and the plan upsert, authorizing a plan total
  // against a balance the patient no longer actually owes.
  if (patientLedgerLocks.has(lockKey)) return fail(res, 409, "Another ledger action for this patient is already in flight — retry shortly");
  paymentPlanLocks.add(lockKey);
  patientLedgerLocks.add(lockKey);
  try {
    // Same "any unpaid schedule = active" invariant the patient-financial agent uses
    // (agents/index.ts's hasActivePlan) — don't let a second plan stack on top of one the
    // patient is already paying down, whatever total it covers.
    const existingPlans = await rcmStore.listPaymentPlans(t, req.params.id);
    if (existingPlans.some((pp) => pp.schedule.some((s) => s.status !== "paid"))) return fail(res, 409, "Patient already has an active payment plan — offer a new one only once the current schedule is fully paid");
    // Without this, a caller-supplied total with no relation to what the patient actually owes
    // could authorize/collect an installment plan for more than the real balance.
    const balance = computeAccount(req.params.id, await rcmStore.ledger(t, req.params.id)).patientBalance;
    if (p.data.total > balance + 0.01) return fail(res, 400, `Plan total $${p.data.total.toFixed(2)} exceeds the patient's outstanding balance $${balance.toFixed(2)}`);
    const plan = createPaymentPlan(req.params.id, p.data.total, p.data.months, p.data.startDate, p.data.autoPay);
    res.json({ success: true, plan: await rcmStore.upsertPaymentPlan(t, plan) });
  } finally {
    paymentPlanLocks.delete(lockKey);
    patientLedgerLocks.delete(lockKey);
  }
}));
rcmRouter.get("/patients/:id/payment-plan", wrap(async (req, res) => res.json({ success: true, plans: await rcmStore.listPaymentPlans(tenantOf(req), req.params.id) })));
rcmRouter.post("/patients/:id/gfe", wrap(async (req, res) => { const p = z.object({ lines: z.array(z.object({ cpt: z.string(), units: z.number().int().positive().default(1) })), selfPayRates: z.record(z.number().nonnegative()).default({}), scheduledDate: isoDate.optional() }).safeParse(req.body); if (!p.success) return bad(res, p.error); const t = tenantOf(req); const pt = await rcmStore.getPatient(t, req.params.id); if (!pt) return fail(res, 404, "patient not found"); res.json({ success: true, gfe: goodFaithEstimate(pt, p.data.lines, p.data.selfPayRates, p.data.scheduledDate) }); }));
// Direct posting is limited to entries that record something that already happened at the
// point of care/reception (a charge, a manually-keyed payment/adjustment, a PR transfer).
// Refunds, write-offs, and denial adjustments forgive or return money and must go through the
// approval-gated agent tools (issue-refund, write-off, small-balance-write-off) instead of a
// raw client-supplied post.
const directLedgerTypes = ["charge", "insurance-payment", "patient-payment", "contractual-adjustment", "transfer-to-patient"] as const;
// insurance-payment/contractual-adjustment only ever settle the insurance side, and
// patient-payment/transfer-to-patient only ever settle the patient side — the type itself
// determines responsibleParty for these, so an omitted field can't silently default to the
// wrong side of computeAccount's split (the Zod schema's own "patient" default is only actually
// ambiguous for "charge", which can legitimately be either self-pay or insurance-billed).
const impliedLedgerParty: Partial<Record<(typeof directLedgerTypes)[number], "insurance" | "patient">> = { "insurance-payment": "insurance", "contractual-adjustment": "insurance", "patient-payment": "patient", "transfer-to-patient": "patient" };
// In-process lock closing the same check-then-append TOCTOU race as remittance posting: two
// concurrent retries carrying the same caller-supplied id could both pass the "not yet posted"
// check (separated from it by several awaits) before either finishes appending.
const ledgerPostInFlight = new Set<string>();
rcmRouter.post("/ledger", wrap(async (req, res) => {
  // `id` is REQUIRED (not defaulted server-side) specifically so it can double as a client
  // idempotency key: every dupe/lock/already-posted check below keys off caller-supplied ids, so
  // a caller that omitted one would get a fresh newId() minted on every retry and silently post
  // the same charge/payment twice after a dropped response, with nothing here able to catch it.
  const p = z.array(z.object({ id: z.string().min(1), patientId: z.string(), claimId: z.string().optional(), type: z.enum(directLedgerTypes), amount: z.number().nonnegative(), date: isoDate, memo: z.string().optional(), responsibleParty: z.enum(["insurance", "patient"]).default("patient") })).safeParse(req.body?.entries ?? req.body);
  if (!p.success) return bad(res, p.error);
  // insurance-payment/contractual-adjustment reduce A/R, and transfer-to-patient shifts
  // responsibility for a caller-supplied amount onto the patient — none of the three have an
  // approval, remittance match, or contract validation behind them on this raw endpoint, so
  // restrict all three to admin. Point-of-care facts (charge, patient-payment) — receipts of
  // something that actually happened rather than a financial-responsibility decision — stay
  // open to the wider RCM role set.
  const adjustmentTypes = new Set<(typeof directLedgerTypes)[number]>(["insurance-payment", "contractual-adjustment", "transfer-to-patient"]);
  if (p.data.some((e) => adjustmentTypes.has(e.type)) && (req as AuthedRequest).userRole !== "admin") return fail(res, 403, "Posting insurance-payment, contractual-adjustment, or transfer-to-patient entries directly requires an admin role");
  const t = tenantOf(req);
  const suppliedIds = p.data.map((e) => e.id);
  // The store-lookup dedup check below only catches ids already posted in a PRIOR request — a
  // single batch repeating the same caller-supplied id would pass that check for both and post
  // both, since neither exists yet. Reject that within-batch collision up front.
  const idCounts = new Map<string, number>();
  for (const id of suppliedIds) idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  const batchDupe = suppliedIds.find((id) => (idCounts.get(id) ?? 0) > 1);
  if (batchDupe) return fail(res, 400, `ledger entry id ${batchDupe} appears more than once in this batch`);
  const lockKeys = suppliedIds.map((id) => `${t}:${id}`);
  // Every entry in this batch changes a patient's ledger balance — take the same shared
  // patientLedgerLocks lock the issue-refund/small-balance-write-off agent tools use, so a direct
  // post here can't land between one of those tools' balance snapshot and its own write (or vice
  // versa) and leave a refund/write-off cap computed against a balance that already moved. See
  // patientLedgerLocks' comment in patient-financials.ts.
  const patientLockKeys = Array.from(new Set(p.data.map((e) => `${t}:${e.patientId}`)));
  // Synchronous check-and-set, before any `await` — see ledgerPostInFlight's comment.
  const inFlightDupe = lockKeys.find((k) => ledgerPostInFlight.has(k));
  const lockedPatient = patientLockKeys.find((k) => patientLedgerLocks.has(k));
  if (inFlightDupe) return fail(res, 409, "one or more of these ledger entries is already being posted");
  if (lockedPatient) return fail(res, 409, "a refund, write-off, or another ledger post for one of these patients is already in flight — retry shortly");
  lockKeys.forEach((k) => ledgerPostInFlight.add(k));
  patientLockKeys.forEach((k) => patientLedgerLocks.add(k));
  try {
    // Even the allowed direct-posting types must reference a real patient (and, if given, a real
    // claim actually belonging to that patient) — otherwise this can fabricate A/R against ids
    // that don't exist or cross-link a payment to the wrong patient's claim.
    for (const e of p.data) {
      if (!(await rcmStore.getPatient(t, e.patientId))) return fail(res, 404, `patient ${e.patientId} not found`);
      if (e.claimId) {
        const claim = await rcmStore.getClaim(t, e.claimId);
        if (!claim) return fail(res, 404, `claim ${e.claimId} not found`);
        if (claim.patientId !== e.patientId) return fail(res, 400, `claim ${e.claimId} does not belong to patient ${e.patientId}`);
      }
    }
    // A caller-supplied id lets a client (or a retried request after a dropped response) be
    // posted idempotently — reject the whole batch if any id already exists rather than silently
    // double-posting the same charge/payment against the ledger.
    if (suppliedIds.length) {
      const existingIds = new Set((await rcmStore.ledger(t)).map((e) => e.id));
      const dupe = suppliedIds.find((id) => existingIds.has(id));
      if (dupe) return fail(res, 409, `ledger entry ${dupe} already posted`);
    }
    const entries = p.data.map((e) => ({ ...e, responsibleParty: impliedLedgerParty[e.type] ?? e.responsibleParty }));
    await rcmStore.postLedger(t, entries);
    res.json({ success: true, posted: entries.length });
  } finally {
    lockKeys.forEach((k) => ledgerPostInFlight.delete(k));
    patientLockKeys.forEach((k) => patientLedgerLocks.delete(k));
  }
}));
rcmRouter.get("/credit-balances", wrap(async (req, res) => res.json({ success: true, credits: detectCreditBalances(await rcmStore.ledgerByPatient(tenantOf(req))) })));

// ---------- Contracts ----------
rcmRouter.get("/contracts", wrap(async (req, res) => res.json({ success: true, contracts: Object.values(await rcmStore.contracts(tenantOf(req))) })));
rcmRouter.post("/contracts/:payerId/expected", wrap(async (req, res) => { const c = await rcmStore.getContract(tenantOf(req), req.params.payerId); if (!c) return fail(res, 404, "contract not found"); const lines = z.array(z.object({ cpt: z.string(), units: z.number().default(1), modifiers: z.array(z.string()).default([]) })).parse(req.body?.lines ?? []); res.json({ success: true, expected: expectedForLines(c, lines) }); }));
rcmRouter.post("/contracts/:payerId/variance", wrap(async (req, res) => { const c = await rcmStore.getContract(tenantOf(req), req.params.payerId); if (!c) return fail(res, 404, "contract not found"); const lines = z.array(z.object({ cpt: z.string(), units: z.number().default(1), modifiers: z.array(z.string()).default([]), allowed: z.number() })).parse(req.body?.lines ?? []); res.json({ success: true, ...varianceReport(c, lines) }); }));
rcmRouter.post("/contracts/:payerId/model", wrap(async (req, res) => { const c = await rcmStore.getContract(tenantOf(req), req.params.payerId); if (!c) return fail(res, 404, "contract not found"); const p = z.object({ volume: z.array(z.object({ cpt: z.string(), units: z.number() })), pctChange: z.number().optional(), overrides: z.record(z.number()).optional() }).safeParse(req.body); if (!p.success) return bad(res, p.error); res.json({ success: true, ...modelContractChange(c, p.data.volume, p.data) }); }));

// ---------- Analytics ----------
rcmRouter.get("/analytics/kpis", wrap(async (req, res) => { const t = tenantOf(req); const stats = await rcmStore.scrubStats(t); const claims = await rcmStore.listClaims(t); const denials = await rcmStore.listDenials(t); const remittances = await rcmStore.listRemittances(t); const ledger = await rcmStore.ledger(t); res.json({ success: true, kpis: computeKpis({ claims, denials, ledger, remittances, scrubTotal: stats.total, scrubFirstPassClean: stats.firstPassClean, chargeEntryLagDays: await rcmStore.chargeLagSamples(t) }), agingByPayer: agingByPayer(claims, ledger), payerScorecard: payerScorecard(claims, denials, remittances), denialTrends: denialTrends(denials) }); }));

// ---------- Work queues ----------
rcmRouter.get("/worklist", wrap(async (req, res) => { const t = tenantOf(req); const q = typeof req.query.queue === "string" ? (req.query.queue as WorkQueue) : undefined; const items = await rcmStore.listWorkItems(t, q); res.json({ success: true, items: sortQueue(items), summary: queueSummary(await rcmStore.listWorkItems(t)) }); }));
rcmRouter.post("/worklist/:id", wrap(async (req, res) => {
  const p = z.object({ status: z.enum(["open", "in-progress", "waiting", "done", "cancelled"]).optional(), assignedTo: z.string().optional() }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const t = tenantOf(req);
  if (p.data.status === "done" || p.data.status === "cancelled") {
    const items = await rcmStore.listWorkItems(t);
    const w = items.find((x) => x.id === req.params.id);
    // An "agent-approval" item tracks a specific approval's disposition — completing it by hand
    // must not be possible while that approval is still pending, or the queue would go quiet on
    // an action nobody actually approved, rejected, or executed.
    if (w?.queue === "agent-approval" && w.context?.approvalId) {
      const approval = (await rcmStore.listApprovals(t)).find((a) => a.id === w.context?.approvalId);
      if (approval && approval.status === "pending") return fail(res, 409, `Linked approval ${approval.id} is still pending — decide it via POST /approvals/:id instead of closing the work item directly`);
    }
  }
  const w = await rcmStore.updateWorkItem(t, req.params.id, p.data);
  return w ? res.json({ success: true, item: w }) : fail(res, 404, "work item not found");
}));

// ---------- Voice ----------
rcmRouter.post("/voice/command", wrap(async (req, res) => {
  const p = z.object({ transcript: z.string().min(1) }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const intent = parseVoiceIntent(p.data.transcript);
  let speak = speakIntent(intent);
  let result: unknown;
  const t = tenantOf(req);
  if (intent.type === "kpi-readout") {
    const stats = await rcmStore.scrubStats(t);
    const kpis = computeKpis({ claims: await rcmStore.listClaims(t), denials: await rcmStore.listDenials(t), ledger: await rcmStore.ledger(t), remittances: await rcmStore.listRemittances(t), scrubTotal: stats.total, scrubFirstPassClean: stats.firstPassClean });
    speak = speakKpis(kpis, intent.kpi);
  } else if (intent.type === "run-agent") {
    // The only spoken intent this endpoint can safely execute outright: agentRuntime.run
    // already gates every money-moving/payer-facing step behind human approval.
    try {
      const r = await agentRuntime.run(intent.agent, t, {}, { actor: actorOf(req) });
      result = r;
      speak = `${r.summary} ${r.approvalsRequested > 0 ? `${r.approvalsRequested} action${r.approvalsRequested === 1 ? "" : "s"} now need your approval.` : ""}`.trim();
    } catch (e) {
      speak = `I could not find an agent named ${intent.agent.replace(/-/g, " ")}.`;
    }
  }
  res.json({ success: true, intent, speak, result });
}));

// ---------- Agents & approvals ----------
rcmRouter.get("/agents", (_req, res) => res.json({ success: true, agents: agentRuntime.list() }));
rcmRouter.post("/agents/:name/run", wrap(async (req, res) => { try { res.json({ success: true, result: await agentRuntime.run(req.params.name, tenantOf(req), req.body?.args ?? {}, { actor: actorOf(req), dryRun: req.body?.dryRun === true }) }); } catch (e) { fail(res, 404, e instanceof Error ? e.message : "agent error"); } }));
rcmRouter.get("/agents/audit", wrap(async (req, res) => res.json({ success: true, audit: await rcmStore.listAudit(tenantOf(req)) })));
rcmRouter.get("/approvals", wrap(async (req, res) => res.json({ success: true, approvals: await rcmStore.listApprovals(tenantOf(req), typeof req.query.status === "string" ? (req.query.status as "pending" | "approved" | "rejected") : undefined) })));
rcmRouter.post("/approvals/:id", wrap(async (req, res) => {
  const p = z.object({ decision: z.enum(["approved", "rejected"]) }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  // The mount only requires admin/provider/clinician, but approving here immediately executes
  // a refund, write-off, agency referral, or claim submission — the same class of direct
  // financial/payer-facing action already restricted to admin elsewhere in this router.
  // Rejecting isn't money-moving, so it stays open to the wider role set.
  if (p.data.decision === "approved" && (req as AuthedRequest).userRole !== "admin") return fail(res, 403, "Approving an agent action requires an admin role");
  const t = tenantOf(req);
  const before = (await rcmStore.listApprovals(t)).find((x) => x.id === req.params.id);
  if (!before) return fail(res, 404, "approval not found");
  const a = await rcmStore.decideApproval(t, req.params.id, p.data.decision, actorOf(req));
  if (!a) return fail(res, 409, `approval already ${before.status}`);
  const exec = p.data.decision === "approved" ? await agentRuntime.executeApproved(t, a.id, actorOf(req)) : undefined;
  // Only clear the work item once the action is actually done (rejected, or approved AND
  // executed) — a failed execution must stay visible in the queue so someone can retry it.
  const wi = await rcmStore.findOpenWorkItem(t, (w) => w.queue === "agent-approval" && w.context?.approvalId === a.id);
  if (wi && (p.data.decision === "rejected" || exec?.ok)) await rcmStore.updateWorkItem(t, wi.id, { status: "done" });
  res.json({ success: true, approval: a, executed: exec });
}));
// Retries executing an approval that was approved but whose execution failed (tool threw, or
// was temporarily unavailable) — decideApproval only accepts a still-pending row, so a failed
// approved-but-unexecuted approval needs its own path back to execution instead of being
// permanently stuck once POST /approvals/:id has already moved it out of "pending".
rcmRouter.post("/approvals/:id/retry", wrap(async (req, res) => {
  // Same admin gate as the approval decision itself — a retry only ever re-executes an already-
  // approved money-moving/payer-facing action.
  if ((req as AuthedRequest).userRole !== "admin") return fail(res, 403, "Retrying an approved agent action requires an admin role");
  const t = tenantOf(req);
  const a = (await rcmStore.listApprovals(t)).find((x) => x.id === req.params.id);
  if (!a) return fail(res, 404, "approval not found");
  if (a.status !== "approved") return fail(res, 409, `approval status is ${a.status}, not approved`);
  if (a.executedAt) return fail(res, 409, "approval already executed");
  const exec = await agentRuntime.executeApproved(t, a.id, actorOf(req));
  if (exec.ok) {
    const wi = await rcmStore.findOpenWorkItem(t, (w) => w.queue === "agent-approval" && w.context?.approvalId === a.id);
    if (wi) await rcmStore.updateWorkItem(t, wi.id, { status: "done" });
  }
  res.json({ success: true, approval: a, executed: exec });
}));

export default rcmRouter;
