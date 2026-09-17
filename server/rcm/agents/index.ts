// The RCM agent fleet. Each agent = deterministic planner + typed tools; money-moving tools
// require human approval (enforced by the runtime). Register all on the shared runtime.
import { agentRuntime, type AgentDefinition, type AgentStep, type Tool, type ToolContext } from "./runtime";
import { aiText } from "./ai";
import { checkEligibility, detectDiscrepancies, eligibilityIsStale, estimatePatientResponsibility, financialClearance } from "../eligibility";
import { authCoversService, authorizedCptsOnFile, consumeAuthUnit, createAuthRequest, linesNeedingAuth, transitionAuth } from "../prior-auth";
import { applyAutoFixes, scrubClaim } from "../scrubber";
import { claimsNeedingFollowUp, correctedClaim, transitionClaim } from "../claims";
import { generateAppealLetter, recommendAction } from "../denials";
import { buildStatement, collectionsStage, computeAccount, createPaymentPlan, detectCreditBalances, patientLedgerLocks, paymentPlanLocks, propensityToPay, smallBalanceWriteOffs } from "../patient-financials";
import { itemsFromAuths, itemsFromClaimFollowUp, itemsFromDenials, itemsFromScrub, makeWorkItem } from "../worklists";
import { computeKpis, outstandingInsurance } from "../analytics";
import { newId, round2, todayIso } from "../util";
import type { Claim, LedgerEntry } from "../types";
import { buildPayerCallScript } from "./payer-call";

// ---------- Eligibility agent ----------
const runEligibility: Tool<{ coverageId: string; patientId: string; dateOfService: string }, unknown> = {
  name: "run-eligibility",
  description: "Run 270/271 for a coverage and store the benefit snapshot",
  async run(input, ctx) {
    const coverage = await ctx.store.getCoverage(ctx.tenantId, input.coverageId);
    const patient = await ctx.store.getPatient(ctx.tenantId, input.patientId);
    if (!coverage || !patient) throw new Error("coverage or patient not found");
    // patientId and coverageId are looked up independently — without this, a caller could pair
    // one patient's demographics with another patient's member coverage, sending mismatched PHI
    // in the 270 request and attaching the resulting benefit snapshot to the wrong coverage.
    if (coverage.patientId !== patient.id) throw new Error("coverage does not belong to this patient");
    const benefits = await checkEligibility({ patient, coverage, dateOfService: input.dateOfService, providerNpi: "1234567893" });
    await ctx.store.setBenefits(ctx.tenantId, coverage.id, benefits);
    // This agent only re-verifies eligibility ahead of a visit — there's no scheduling/appointment
    // model here to tell it which CPT will actually be billed, so it must not fabricate an
    // estimate for one. A hardcoded placeholder (previously 99213) would silently pass a fixed
    // set of assumptions into financialClearance regardless of the real service — worse, it never
    // even checked auth/referral requirements here (opts.requiresAuth/authOnFile were never
    // passed), so an auth-required visit could still be reported "cleared" no matter what CPT was
    // guessed. Pass no lines and no auth/referral opts: this only surfaces the coverage-level
    // blockers that hold regardless of which service gets billed (inactive coverage, demographic
    // mismatch, network status, stub vendor). The front desk still runs the CPT-specific
    // /eligibility/check with the actual planned lines once those are known, which is where a
    // real per-visit collectAtVisit estimate and auth/referral check belong.
    const disc = detectDiscrepancies({ firstName: patient.firstName, lastName: patient.lastName, dob: patient.dob, memberId: coverage.memberId }, benefits.payerSubscriber ?? {});
    const clearance = financialClearance(benefits, estimatePatientResponsibility([], benefits), disc);
    if (!clearance.cleared) await ctx.store.addWorkItems(ctx.tenantId, [makeWorkItem({ queue: "eligibility", title: `Not cleared: ${clearance.reasons.join("; ")}`, patientId: patient.id, priority: 75, source: "agent", context: { coverageId: coverage.id, actions: clearance.actions } })]);
    return { active: benefits.active, cleared: clearance.cleared };
  },
};

const eligibilityAgent: AgentDefinition = {
  name: "eligibility",
  description: "Pre-visit: re-verifies stale/missing eligibility for every scheduled patient and opens clearance work items.",
  tools: [runEligibility],
  async plan(ctx, args) {
    const dos = typeof args.dateOfService === "string" ? args.dateOfService : todayIso();
    const steps: AgentStep[] = [];
    for (const p of await ctx.store.listPatients(ctx.tenantId)) {
      for (const c of await ctx.store.coveragesForPatient(ctx.tenantId, p.id)) {
        const snap = await ctx.store.getBenefits(ctx.tenantId, c.id);
        if (eligibilityIsStale(snap, dos)) steps.push({ tool: "run-eligibility", input: { coverageId: c.id, patientId: p.id, dateOfService: dos }, why: snap ? "benefit snapshot older than 30 days" : "no eligibility on file" });
      }
    }
    return steps;
  },
  summarize: (s) => `Eligibility: ${s.filter((x) => x.outcome === "ok").length} checks run, ${s.filter((x) => x.outcome === "ok" && (x.output as { cleared?: boolean })?.cleared === false).length} need front-desk action.`,
};

// ---------- Prior-auth agent ----------
// Not approval-gated, unlike claim submission/appeals/write-offs/refunds: a 278 request is an
// industry-standard automated real-time transaction, not a money-moving or payer-commitment
// action needing human sign-off. That means it also gets none of the runtime's own approval-
// request dedup (that check only runs for `requiresApproval` tools) — two concurrent prior-auth
// runs can each plan an open-auth-request step from the same stale `auths` snapshot before
// either has written its new request. Close that race the same way denial actions and remittance
// posting do: a synchronous, per-request-identity in-process lock (see the tool body for why
// there is no additional business-state dedup on top of it).
const openAuthLocks = new Set<string>();
const openAuth: Tool<{ patientId: string; coverageId: string; payerId: string; cpt: string; diagnoses: string[]; dateOfService?: string; units?: number }, unknown> = {
  name: "open-auth-request",
  description: "Create and mark requested a prior-auth for an auth-required service",
  async run(input, ctx) {
    const cpt = input.cpt.toUpperCase();
    const lockKey = `${ctx.tenantId}:${input.patientId}:${input.coverageId}:${input.payerId}:${cpt}:${input.dateOfService ?? ""}`;
    if (openAuthLocks.has(lockKey)) throw new Error("Another auth request for this patient/coverage/CPT/date is already in flight");
    openAuthLocks.add(lockKey);
    try {
      // No business-state "is this already covered" recheck here, deliberately — two attempts
      // (first a raw units >= comparison, then an exact units === match) both wrongly treated a
      // pre-existing pending auth for the same key as covering THIS call's need, when that auth's
      // capacity may already be fully spoken for by a different line via plan()'s own
      // pendingUnitsClaimed accounting, which is pass-local and never persisted — nothing at this
      // tool's level can reliably tell "an identical concurrent duplicate of MY OWN call" apart
      // from "a distinct, genuinely additional need that happens to look the same from here". The
      // lock above already fully closes the concurrency race this was meant to guard (two
      // overlapping runs can't both create a request for the same key at the same time — the
      // loser fails closed and gets picked up on the next scheduled pass); it is deliberately the
      // ONLY protection here.
      const pa = transitionAuth(createAuthRequest(input), "requested", { actor: ctx.actor, note: "Agent-submitted 278 (stub)" });
      await ctx.store.upsertAuth(ctx.tenantId, pa);
      await ctx.store.addWorkItems(ctx.tenantId, itemsFromAuths([pa]));
      return { authId: pa.id, slaDeadline: pa.slaDeadline, missingDocumentation: pa.missingDocumentation };
    } finally {
      openAuthLocks.delete(lockKey);
    }
  },
};
const attachAuth: Tool<{ claimId: string; authId: string }, unknown> = {
  name: "attach-auth-to-claim",
  description: "Attach an approved auth number to a claim",
  async run(input, ctx) {
    const claim = await ctx.store.getClaim(ctx.tenantId, input.claimId);
    const auth = await ctx.store.getAuth(ctx.tenantId, input.authId);
    if (!claim || !auth?.authNumber) throw new Error("claim or approved auth missing");
    // Re-verify identity at execution time, not just what plan() saw — this tool isn't
    // approval-gated (a 278 attach is automated, not a money-moving/payer-commitment action), so
    // nothing else rechecks the auth/claim relationship between planning and this step actually
    // running. Either record can change in that window; attaching a mismatched auth would send
    // the wrong authorization number in box 23.
    if (auth.patientId !== claim.patientId || auth.coverageId !== claim.coverageId || auth.payerId !== claim.payerId) throw new Error("authorization no longer matches this claim's patient/coverage/payer");
    if (!claim.lines.some((l) => authCoversService(auth, l.cpt, l.dateOfService, l.units).ok)) throw new Error("authorization no longer covers any line on this claim");
    await ctx.store.upsertClaim(ctx.tenantId, { ...claim, priorAuthNumber: auth.authNumber });
    return { attached: auth.authNumber };
  },
};
const priorAuthAgent: AgentDefinition = {
  name: "prior-auth",
  description: "Finds draft claims with auth-required services, opens 278 requests, attaches approved auth numbers, escalates SLA breaches.",
  tools: [openAuth, attachAuth],
  async plan(ctx) {
    const steps: AgentStep[] = [];
    const auths = await ctx.store.listAuths(ctx.tenantId);
    // Escalate existing auths, not just freshly-opened ones — an SLA-breached requested/pended
    // auth or a soon-to-expire approved auth needs a work item on every scan, not only the run
    // that first created it (openAuth's own itemsFromAuths call fires before any SLA deadline
    // could have passed, so this is the only place that catches a breach or a renewal window).
    if (!ctx.dryRun) {
      const flagged = itemsFromAuths(auths);
      const withoutOpenItem: typeof flagged = [];
      for (const item of flagged) {
        const existing = await ctx.store.findOpenWorkItem(ctx.tenantId, (w) => w.queue === "prior-auth" && w.context?.authId === item.context?.authId);
        if (!existing) withoutOpenItem.push(item);
      }
      if (withoutOpenItem.length) await ctx.store.addWorkItems(ctx.tenantId, withoutOpenItem);
    }
    // Merge duplicate auth-required lines (same patient/coverage/CPT, possibly across several
    // draft claims) into a single 278 request with combined units, instead of opening one per
    // line — otherwise two identical lines on a claim would each open their own auth record.
    const pendingOpens = new Map<string, { patientId: string; coverageId: string; payerId: string; cpt: string; diagnoses: string[]; dateOfService: string; units: number; why: string }>();
    // Tracks how many units of each pending (requested/pended) auth record have already been
    // attributed to an earlier line in this same plan() pass — without this, two independent
    // 1-unit lines could each individually check against the same 1-unit pending request and both
    // be (wrongly) skipped as "already covered", leaving the second line's units never requested.
    const pendingUnitsClaimed = new Map<string, number>();
    // Same idea for APPROVED auths: authCoversService only checks the auth's own stored
    // unitsUsed, which doesn't advance until a claim is actually submitted (consumeAuthUnit)
    // — so within a single plan() pass, two different draft claims' one-unit lines could both
    // independently pass authCoversService against the SAME one-unit approved auth and both get
    // attach-auth-to-claim steps, leaving the second claim to fail at submission with no new
    // request ever opened for it. Track claimed units the same way pendingUnitsClaimed does.
    const approvedUnitsClaimed = new Map<string, number>();
    for (const claim of await ctx.store.listClaims(ctx.tenantId, { status: "draft" })) {
      const contract = await ctx.store.getContract(ctx.tenantId, claim.payerId);
      for (const { line, check } of linesNeedingAuth(claim.lines, contract)) {
        // Consider every auth on file for this patient/coverage/payer/CPT, not just the first
        // match — a leftover denied/expired row must never shadow a later approved one, and an
        // approved auth from a *different* coverage/payer must never clear this one's requirement.
        // auth.cpt is always uppercased (createAuthRequest normalizes it) but a claim line's CPT
        // isn't guaranteed to be — normalize both sides so e.g. "j0135" still matches "J0135".
        const matches = auths.filter((a) => a.patientId === claim.patientId && a.coverageId === claim.coverageId && a.payerId === claim.payerId && a.cpt === line.cpt.toUpperCase());
        const usable = matches.find((a) => authCoversService(a, line.cpt, line.dateOfService, line.units).ok && a.units - a.unitsUsed - (approvedUnitsClaimed.get(a.id) ?? 0) >= line.units);
        if (usable) {
          approvedUnitsClaimed.set(usable.id, (approvedUnitsClaimed.get(usable.id) ?? 0) + line.units);
          if (!claim.priorAuthNumber) steps.push({ tool: "attach-auth-to-claim", input: { claimId: claim.id, authId: usable.id }, why: "approved auth on file" });
          continue;
        }
        // A pending request only covers this line if it was opened for the SAME date of service
        // (a request opened for one visit must not silently absorb a different visit's units,
        // leaving the original visit to open a duplicate request while the later one is wrongly
        // treated as already covered) and its remaining (unclaimed-so-far-this-pass) capacity is
        // at least as many units as the line needs — a 1-unit request already in flight must not
        // silently swallow two different 1-unit lines.
        const pendingMatch = matches.filter((a) => (a.status === "requested" || a.status === "pended") && a.dateOfService === line.dateOfService).find((a) => a.units - (pendingUnitsClaimed.get(a.id) ?? 0) >= line.units);
        if (pendingMatch) { pendingUnitsClaimed.set(pendingMatch.id, (pendingUnitsClaimed.get(pendingMatch.id) ?? 0) + line.units); continue; }
        // Include the date of service in the key — merging lines from different dates would
        // combine unrelated visits into one request/validity window, rejecting the visit that
        // falls outside it (or reusing one authorization for dates it was never approved for).
        const key = `${claim.patientId}|${claim.coverageId}|${line.cpt}|${line.dateOfService}`;
        const existing = pendingOpens.get(key);
        // Request enough units for the line itself — otherwise a fresh 1-unit-default auth can
        // never satisfy a multi-unit line and the agent re-opens a request every run.
        if (existing) existing.units += line.units;
        else pendingOpens.set(key, { patientId: claim.patientId, coverageId: claim.coverageId, payerId: claim.payerId, cpt: line.cpt, diagnoses: claim.diagnoses.map((d) => d.code), dateOfService: line.dateOfService, units: line.units, why: check.reason ?? "auth required" });
      }
    }
    for (const { why, ...input } of Array.from(pendingOpens.values())) steps.push({ tool: "open-auth-request", input, why });
    return steps;
  },
  summarize: (s) => `Prior auth: ${s.filter((x) => x.tool === "open-auth-request" && x.outcome === "ok").length} requests opened, ${s.filter((x) => x.tool === "attach-auth-to-claim" && x.outcome === "ok").length} auth numbers attached.`,
};

// ---------- Scrubber agent ----------
const scrubAndFix: Tool<{ claimId: string }, unknown> = {
  name: "scrub-claim",
  description: "Scrub a draft claim, apply safe auto-fixes, move clean claims to ready, open edit work items otherwise",
  async run(input, ctx) {
    const claim = await ctx.store.getClaim(ctx.tenantId, input.claimId);
    if (!claim) throw new Error("claim not found");
    const patient = await ctx.store.getPatient(ctx.tenantId, claim.patientId);
    const coverage = await ctx.store.getCoverage(ctx.tenantId, claim.coverageId);
    const contract = await ctx.store.getContract(ctx.tenantId, claim.payerId);
    const others = (await ctx.store.listClaims(ctx.tenantId, { patientId: claim.patientId })).filter((c) => c.id !== claim.id);
    // The full payer-aware auth requirement (contract list + DEFAULT_AUTH_RULES + gold-carding).
    const authRequiredCpts = linesNeedingAuth(claim.lines, contract).map((x) => x.line.cpt);
    const auths = await ctx.store.listAuths(ctx.tenantId);
    // applyAutoFixes never touches priorAuthNumber, so the same validated flag holds for both
    // the pre-fix and post-fix scrub passes.
    const authorizedCpts = authorizedCptsOnFile(claim.priorAuthNumber, claim.patientId, claim.coverageId, claim.payerId, claim.lines, auths);
    const first = scrubClaim(claim, { patient, coverage, authRequiredCpts, authorizedCpts, priorClaimsSameDos: others });
    await ctx.store.recordScrub(ctx.tenantId, first.clean);
    const fixed = applyAutoFixes(claim, first.edits);
    const second = scrubClaim(fixed.claim, { patient, coverage, authRequiredCpts, authorizedCpts, priorClaimsSameDos: others });
    let next = claim.status === "draft" ? transitionClaim(fixed.claim, "scrubbed", ctx.actor, `score ${second.score}`) : fixed.claim;
    if (second.clean && next.status === "scrubbed") next = transitionClaim(next, "ready", ctx.actor, "clean");
    await ctx.store.upsertClaim(ctx.tenantId, next);
    if (!second.clean && !(await ctx.store.findOpenWorkItem(ctx.tenantId, (w) => w.queue === "claim-edits" && w.claimId === next.id))) {
      await ctx.store.addWorkItems(ctx.tenantId, itemsFromScrub(next, second.errors.length));
    }
    return { clean: second.clean, score: second.score, autoFixed: fixed.applied, errors: second.errors.map((e) => e.id) };
  },
};
// In-process lock on the authorization actually being consumed, not the approval id — two
// different claims can both carry the same priorAuthNumber, and without this two concurrent
// submissions could both read the same stale unitsUsed and both decide they fit.
const submitAuthLocks = new Set<string>();
// Exposed so /prior-auth/:id/transition (routes.ts) can refuse to change an auth's status while
// a submission is mid-flight consuming it — otherwise an admin transition (expire/exhaust/deny)
// landing in the window this lock covers (validation through final unit consumption) would let
// submit-claim mark the claim "submitted" against an authorization the payer-facing send no
// longer actually has, with only a best-effort reconciliation work item as the fallback.
export function isAuthSubmitLocked(tenantId: string, authId: string): boolean {
  return submitAuthLocks.has(`${tenantId}:${authId}`);
}
// In-process lock on a denial id: send-appeal/write-off/transfer-to-patient/file-corrected-claim
// each read the denial's status, act on it, and only then write the resolved status back — two
// different approved actions on the same denial (e.g. write-off and transfer-to-patient, or two
// stale approvals for the same action) can otherwise both observe "open" before either posts its
// ledger entry, causing duplicate or conflicting financial actions on the same denial.
const denialActionLocks = new Set<string>();
// A matching totalCharge alone doesn't bind an approval to the actual claim content an admin
// reviewed — a provider could revert to draft, swap lines/modifiers/diagnoses/dates of service to
// something that happens to sum to the same total, then re-scrub back to ready. Fingerprint the
// claim's billable AND payer-facing content (independent of its own dollar amounts, which the
// totalCharge check already covers) so submit-claim can also detect that class of drift, not just
// an amount change. Includes the claim-level placeOfService/priorAuthNumber/referralNumber too —
// none of those affect totalCharge, but each changes what actually goes out on the 837P/CMS-1500
// (box 24b, box 23, box 17a) versus what the approver reviewed.
function claimContentFingerprint(c: Pick<Claim, "lines" | "diagnoses" | "placeOfService" | "priorAuthNumber" | "referralNumber">): string {
  return JSON.stringify({
    lines: c.lines.map((l) => ({ cpt: l.cpt, units: l.units, charge: l.charge, ndc: l.ndc, renderingNpi: l.renderingNpi, modifiers: [...l.modifiers].sort(), dxPointers: l.dxPointers, dateOfService: l.dateOfService, placeOfService: l.placeOfService })),
    diagnoses: c.diagnoses.map((d) => d.code),
    claimPlaceOfService: c.placeOfService,
    priorAuthNumber: c.priorAuthNumber,
    referralNumber: c.referralNumber,
  });
}
const submitClaim: Tool<{ claimId: string; amount: number; contentFingerprint?: string }, unknown> = {
  name: "submit-claim",
  description: "Submit a ready claim to the clearinghouse (837P)",
  requiresApproval: true,
  approvalReason: "payer-facing submission",
  async run(input, ctx) {
    const claim = await ctx.store.getClaim(ctx.tenantId, input.claimId);
    if (!claim) throw new Error("claim not found");
    // input.amount is the claim's totalCharge captured at plan()/approval-request time — what an
    // admin actually reviewed and approved. A provider/clinician could transition this claim back
    // to "draft", patch its charges/lines, and re-scrub it to "ready" again before this approved
    // step executes; canTransition alone wouldn't catch that (ready → submitted is legal either
    // way), so the claim that actually goes out could silently differ in dollar amount from the
    // one the approval was granted for. Fail closed on any drift and require a fresh approval
    // instead of submitting a claim the approver never actually reviewed.
    if (round2(claim.totalCharge) !== round2(input.amount)) throw new Error(`Claim total ($${claim.totalCharge.toFixed(2)}) no longer matches the amount ($${input.amount.toFixed(2)}) this approval was requested for — the claim changed since approval; re-scrub and request a fresh approval`);
    // Catches a content swap (lines/modifiers/diagnoses/dates) that happens to land on the same
    // total, which the amount check above can't see. Optional/best-effort: only enforced when a
    // fingerprint was actually captured at plan() time, so a caller/test that predates this field
    // isn't blocked — every real plan()-driven approval request always includes one.
    if (input.contentFingerprint !== undefined && input.contentFingerprint !== claimContentFingerprint(claim)) throw new Error(`This claim's content (lines, diagnoses, place of service, prior auth, or referral) no longer matches what this approval was requested for — the claim changed since approval; re-scrub and request a fresh approval`);
    // /coverage can upsert (replace) an existing record by id — the same check the /claims/:id/837p
    // route already makes before exporting. Without it, a coverage record replaced with a
    // different patient's or payer's data after this claim was created/scrubbed could be marked
    // "submitted" (837P sent) here despite no longer actually matching this claim.
    const coverage = await ctx.store.getCoverage(ctx.tenantId, claim.coverageId);
    if (!coverage || coverage.patientId !== claim.patientId || coverage.payerId !== claim.payerId) throw new Error("coverage on file no longer matches this claim's patient/payer — re-verify before submitting");
    const auths = await ctx.store.listAuths(ctx.tenantId);
    // Revalidate against the same rules a fresh prior-auth check uses (status, date of service,
    // remaining units) right before submission — scrubbing happened earlier, and any auth could
    // have expired, been denied, or been exhausted by another claim since. Check EVERY
    // auth-required line against ALL matching auth records on file (matched on patient, coverage,
    // AND payer — never let an unrelated payer's authorization be selected), not just whichever
    // single line(s) happen to share the one priorAuthNumber attached to the claim: a claim can
    // carry more than one auth-required CPT even though this schema only tracks one attached
    // number, and a box-23 number that's purely informational (gold-carded CPTs, or one carried
    // over onto a secondary/COB claim for a different payer/coverage) must not block a line that
    // never needed it, while a DIFFERENT required CPT with no coverage at all must still block.
    //
    // Group by CPT + date of service, not CPT alone — the prior-auth agent itself opens a
    // separate request per distinct date, so a split, multi-visit claim can legitimately carry
    // two different approved auths for the same CPT, each covering only its own visit's units.
    // For each bucket, pick a SPECIFIC covering auth (not just "some auth covers it") and reserve
    // its units against further buckets in this same pass — two buckets checked independently
    // against the same auth's static (persisted) unitsUsed could otherwise both "pass" against
    // one auth that only actually has enough units for one of them.
    const contract = await ctx.store.getContract(ctx.tenantId, claim.payerId);
    const requiredLines = linesNeedingAuth(claim.lines, contract);
    const byCptAndDate = new Map<string, { cpt: string; dateOfService: string; units: number }>();
    for (const { line } of requiredLines) {
      const key = `${line.cpt.toUpperCase()}|${line.dateOfService}`;
      const existing = byCptAndDate.get(key);
      if (existing) existing.units += line.units;
      else byCptAndDate.set(key, { cpt: line.cpt.toUpperCase(), dateOfService: line.dateOfService, units: line.units });
    }
    const reservedByAuthId = new Map<string, number>();
    const consumption = new Map<string, number>();
    const buckets = Array.from(byCptAndDate.values());
    const assigned = new Map<string, (typeof auths)[number]>();
    const coveringFor = (cpt: string) => auths.filter((a) => a.patientId === claim.patientId && a.coverageId === claim.coverageId && a.payerId === claim.payerId && a.cpt === cpt);
    const stillCovers = (a: (typeof auths)[number], cpt: string, dateOfService: string, units: number) => authCoversService({ ...a, unitsUsed: a.unitsUsed + (reservedByAuthId.get(a.id) ?? 0) }, cpt, dateOfService, units).ok;
    // Two passes, not one: every bucket gets first dibs on the auth actually requested FOR its
    // own exact date of service before ANY bucket is allowed to fall back to a differently-dated
    // auth that merely happens to also cover it (e.g. a broader validity window). A single greedy
    // pass processed in claim-line order could otherwise let a later visit's bucket "steal" an
    // earlier visit's own dedicated authorization before the earlier visit ever gets to claim it,
    // failing a submission that a correct, date-aware assignment would have allowed.
    for (const bucket of buckets) {
      const exact = coveringFor(bucket.cpt).find((a) => a.dateOfService === bucket.dateOfService && stillCovers(a, bucket.cpt, bucket.dateOfService, bucket.units));
      if (exact) { assigned.set(`${bucket.cpt}|${bucket.dateOfService}`, exact); reservedByAuthId.set(exact.id, (reservedByAuthId.get(exact.id) ?? 0) + bucket.units); }
    }
    for (const bucket of buckets) {
      const key = `${bucket.cpt}|${bucket.dateOfService}`;
      let match = assigned.get(key);
      if (!match) {
        match = coveringFor(bucket.cpt).find((a) => stillCovers(a, bucket.cpt, bucket.dateOfService, bucket.units));
        if (!match) throw new Error(`No authorization on file covers ${bucket.cpt} on ${bucket.dateOfService} for this claim (never obtained, expired, wrong date of service, or insufficient units) — verify before submitting`);
        reservedByAuthId.set(match.id, (reservedByAuthId.get(match.id) ?? 0) + bucket.units);
      }
      consumption.set(match.id, (consumption.get(match.id) ?? 0) + bucket.units);
    }
    // Lock every auth this submission is about to consume from — a submission spanning two
    // auths must not let a concurrent submission race either one individually.
    const lockKeys = Array.from(consumption.keys()).map((id) => `${ctx.tenantId}:${id}`);
    if (lockKeys.some((k) => submitAuthLocks.has(k))) throw new Error("An authorization needed for this claim is already being consumed by another in-flight submission");
    lockKeys.forEach((k) => submitAuthLocks.add(k));
    try {
      // Re-fetch and re-validate every auth we're about to consume BEFORE transitioning the claim
      // — not reusing the `auths` snapshot taken before the lock above, since that only guards
      // against another concurrent submission, not an admin independently expiring/exhausting/
      // voiding this same auth (via the separate auth transition route, which shares no lock with
      // submissions). This validation pass must complete before the claim transition below: a
      // throw AFTER the claim is already "submitted" would leave it stuck, since "submitted" has
      // no legal self-transition and a retry's very first step would immediately fail closed.
      for (const [authId, units] of Array.from(consumption.entries())) {
        const current = await ctx.store.getAuth(ctx.tenantId, authId);
        if (!current || current.status !== "approved" || current.unitsUsed + units > current.units) {
          throw new Error(`Authorization ${authId} is no longer approved or lacks enough remaining units — it changed after this submission began; re-verify before resubmitting`);
        }
      }
      // Consume each matched auth's units at the moment the claim actually goes out — attaching
      // an auth number never did, so a one-unit authorization stayed at zero units used and could
      // be reused indefinitely. Transition the claim only after every auth has already been
      // validated above: if the claim transition itself throws (e.g. it's no longer "ready"), the
      // units must stay untouched so a retry doesn't burn more of them for a submission that never
      // actually went out.
      await ctx.store.upsertClaim(ctx.tenantId, transitionClaim(claim, "submitted", ctx.actor, "837P sent (stub clearinghouse)"));
      for (const [authId, units] of Array.from(consumption.entries())) {
        // Re-fetch again here rather than reusing the validation pass's snapshot: writing that
        // snapshot back via consumeAuthUnit would silently resurrect an "approved" auth an admin
        // invalidated in the (tiny, but real) window between validation and this write. The claim
        // has already been transitioned by this point, so — unlike the validation pass above —
        // this must never throw (that would leave the claim stuck at "submitted" with no legal
        // self-transition); if the auth changed in that window, skip consuming it and flag the
        // mismatch for manual reconciliation instead of either overwriting fresh state with stale
        // data or stranding an already-sent claim.
        const fresh = await ctx.store.getAuth(ctx.tenantId, authId);
        if (fresh && fresh.status === "approved" && fresh.unitsUsed + units <= fresh.units) {
          await ctx.store.upsertAuth(ctx.tenantId, consumeAuthUnit(fresh, units));
        } else {
          await ctx.store.addWorkItems(ctx.tenantId, [makeWorkItem({ queue: "prior-auth", title: `Authorization ${authId} changed while claim ${claim.id} was being submitted — units may be unreconciled`, patientId: claim.patientId, claimId: claim.id, priority: 80, source: "system" })]);
        }
      }
      // Only now — the corrected claim actually left for the payer — does the denial it was
      // filed to resolve become "appealed". Guard on "in-progress" so an already-resolved
      // (overturned/written-off/re-appealed-elsewhere) denial isn't clobbered by a stale claim.
      if (claim.resolvesDenialId) {
        const d = await ctx.store.getDenial(ctx.tenantId, claim.resolvesDenialId);
        if (d && d.status === "in-progress") await ctx.store.upsertDenial(ctx.tenantId, { ...d, status: "appealed" });
      }
      return { submitted: claim.id };
    } finally {
      lockKeys.forEach((k) => submitAuthLocks.delete(k));
    }
  },
};
const scrubberAgent: AgentDefinition = {
  name: "claim-scrubber",
  description: "Scrubs every draft claim, applies safe auto-fixes, stages clean claims for submission (submission itself requires approval).",
  tools: [scrubAndFix, submitClaim],
  async plan(ctx) {
    const steps: AgentStep[] = [];
    for (const c of await ctx.store.listClaims(ctx.tenantId, { status: "draft" })) steps.push({ tool: "scrub-claim", input: { claimId: c.id }, why: "draft claim" });
    for (const c of await ctx.store.listClaims(ctx.tenantId, { status: "ready" })) steps.push({ tool: "submit-claim", input: { claimId: c.id, patientId: c.patientId, amount: c.totalCharge, contentFingerprint: claimContentFingerprint(c) }, why: `clean claim $${c.totalCharge.toFixed(2)} to ${c.payerName}` });
    return steps;
  },
  summarize: (s) => `Scrubber: ${s.filter((x) => x.tool === "scrub-claim" && x.outcome === "ok").length} scrubbed, ${s.filter((x) => x.tool === "scrub-claim" && (x.output as { clean?: boolean })?.clean).length} clean, ${s.filter((x) => x.outcome === "needs-approval").length} submissions awaiting approval.`,
};

// ---------- Claim follow-up agent ----------
const checkStatus: Tool<{ claimId: string }, unknown> = {
  name: "check-claim-status",
  description: "Query 276/277 status (stub) and open follow-up work",
  async run(input, ctx) {
    const claim = await ctx.store.getClaim(ctx.tenantId, input.claimId);
    if (!claim) throw new Error("claim not found");
    const rows = claimsNeedingFollowUp([claim], todayIso());
    if (rows.length) {
      const existing = await ctx.store.findOpenWorkItem(ctx.tenantId, (w) => w.queue === "claim-followup" && w.claimId === claim.id);
      if (!existing) await ctx.store.addWorkItems(ctx.tenantId, itemsFromClaimFollowUp(rows));
    }
    return { claimId: claim.id, status: claim.status, followUp: rows[0]?.reason ?? null };
  },
};
const followUpAgent: AgentDefinition = {
  name: "claim-followup",
  description: "Finds submitted claims with no adjudication after 30 days or near timely-filing, checks status, and queues payer follow-up (with a call script).",
  tools: [checkStatus],
  async plan(ctx) {
    const rows = claimsNeedingFollowUp(await ctx.store.listClaims(ctx.tenantId), todayIso());
    return rows.map((r) => ({ tool: "check-claim-status", input: { claimId: r.claim.id }, why: r.reason }));
  },
  summarize: (s) => `Follow-up: ${s.length} stale claims reviewed, ${s.filter((x) => (x.output as { followUp?: string | null })?.followUp).length} queued for payer contact.`,
};

// ---------- Denial agent ----------
const triageDenial: Tool<{ denialId: string }, unknown> = {
  name: "triage-denial",
  description: "Root-cause a denial, recommend action, draft appeal text where appealable",
  async run(input, ctx) {
    const d = await ctx.store.getDenial(ctx.tenantId, input.denialId);
    if (!d) throw new Error("denial not found");
    const claim = await ctx.store.getClaim(ctx.tenantId, d.claimId);
    const rec = recommendAction(d);
    let appealDraft: string | undefined;
    if (claim && rec.action === "appeal") {
      const patient = await ctx.store.getPatient(ctx.tenantId, d.patientId);
      const base = generateAppealLetter({ denial: d, claim, patientName: patient ? `${patient.firstName} ${patient.lastName}` : "Patient", providerName: claim.renderingProviderName ?? "Rendering Provider", practiceName: "World EHR Outpatient" });
      const polished = await aiText("You polish payer appeal letters. Keep every fact, code, date, and amount exactly as given; improve clarity and persuasiveness only. Return the letter text.", base.letter, base.letter, "rcm-appeal");
      // The prompt is not an enforcement mechanism: verify the protected facts a human approver
      // relies on (the CARC and the dollar amount) actually survived the rewrite before trusting
      // it, and fall back to the deterministic, fact-only letter otherwise.
      const protectedFacts = [`CARC ${d.carc}`, `$${d.amount.toFixed(2)}`];
      appealDraft = protectedFacts.every((f) => polished.text.includes(f)) ? polished.text : base.letter;
    }
    // Triage itself is read-only on the denial's own status: the recommended action is a
    // separate, approval-gated step, and marking this "in-progress" unconditionally here would
    // make the denial vanish from the next scan's `listDenials(..., "open")` if that action is
    // later rejected or fails — with no way back into automatic triage. Only the tool that
    // actually completes the remediation (write-off, appeal, corrected claim) should move it out
    // of "open".
    return { denialId: d.id, recommendation: rec, appealDraft };
  },
};
const fileCorrectedClaim: Tool<{ claimId: string; denialId: string; amount: number; patch?: Partial<Pick<Claim, "diagnoses" | "lines" | "priorAuthNumber" | "referralNumber" | "placeOfService">> }, unknown> = {
  name: "file-corrected-claim",
  description: "Create a frequency-7 replacement claim for a remediable denial, re-scrubbed and auto-fixed before it goes to approval",
  requiresApproval: true,
  approvalReason: "resubmission to payer",
  async run(input, ctx) {
    // Held for the whole run, not just the initial check — this action's scrub/auth-lookup work
    // between reading the denial and writing "in-progress" back is much longer than the other
    // denial actions', so without holding the lock the whole time, a locked write-off/appeal/
    // transfer that starts and finishes entirely inside that window could have its resolved
    // status silently overwritten by this action's unconditional final write below.
    const lockKey = `${ctx.tenantId}:${input.denialId}`;
    if (denialActionLocks.has(lockKey)) throw new Error("Another action on this denial is already in flight");
    denialActionLocks.add(lockKey);
    try {
      const orig = await ctx.store.getClaim(ctx.tenantId, input.claimId);
      if (!orig) throw new Error("claim not found");
      const denialBefore = await ctx.store.getDenial(ctx.tenantId, input.denialId);
      // Revalidate before staging a replacement claim — an approval can sit pending for a while,
      // and another action (or a human) may have already resolved this denial in the meantime.
      if (!denialBefore || denialBefore.status !== "open") throw new Error(`Denial ${input.denialId} is no longer open — this approval is stale`);
      // The approval payload supplies both ids independently — without this, a caller could stage
      // a corrected claim for one claim while marking an UNRELATED denial as resolved by pointing
      // resolvesDenialId at it, silently removing that other denial from the open queue with no
      // actual remediation performed against it.
      if (denialBefore.claimId !== input.claimId) throw new Error(`Denial ${input.denialId} does not belong to claim ${input.claimId}`);
      // A bare frequency-7 clone with no remediation would carry the exact same errors that
      // triggered the denial (and would trip the same CARC again). Re-scrub the clone and apply
      // safe auto-fixes; anything not auto-fixable goes to a claim-edits work item for a human
      // instead of silently resubmitting a claim that will just be denied again.
      const patient = await ctx.store.getPatient(ctx.tenantId, orig.patientId);
      const coverage = await ctx.store.getCoverage(ctx.tenantId, orig.coverageId);
      const contract = await ctx.store.getContract(ctx.tenantId, orig.payerId);
      // A bare clone (no patch) carries the exact diagnoses/lines/auth/POS that were already
      // clean per our own scrubber at original submission time — otherwise the claim could never
      // have reached "ready"/submitted in the first place. Re-scrubbing that identical clone will
      // therefore also report clean regardless of why the payer denied it, so scrub cleanliness
      // alone can't be used as evidence the denial's actual cause was addressed. Only a caller-
      // supplied, denial-specific patch counts as a real correction.
      const hasCorrection = !!input.patch && Object.keys(input.patch).length > 0;
      const draft = { ...correctedClaim(orig, input.patch ?? {}), resolvesDenialId: input.denialId };
      const authRequiredCpts = linesNeedingAuth(draft.lines, contract).map((x) => x.line.cpt);
      const auths = await ctx.store.listAuths(ctx.tenantId);
      const authorizedCpts = authorizedCptsOnFile(draft.priorAuthNumber, draft.patientId, draft.coverageId, draft.payerId, draft.lines, auths);
      const scrubCtx = { patient, coverage, authRequiredCpts, authorizedCpts };
      const first = scrubClaim(draft, scrubCtx);
      const fixed = applyAutoFixes(draft, first.edits);
      const second = scrubClaim(fixed.claim, scrubCtx);
      // A clean, actually-corrected claim should be staged for resubmission (the same draft →
      // scrubbed → ready lifecycle scrub-claim uses); an uncorrected clone stays capped at
      // "scrubbed" even when clean, so it can't be auto-resubmitted as though the denial's cause
      // had been fixed.
      let next = fixed.claim;
      if (next.status === "draft") next = transitionClaim(next, "scrubbed", ctx.actor, `corrected claim score ${second.score}`);
      if (second.clean && hasCorrection && next.status === "scrubbed") next = transitionClaim(next, "ready", ctx.actor, "clean");
      await ctx.store.upsertClaim(ctx.tenantId, next);
      const needsHumanEdit = !hasCorrection || !second.clean;
      if (needsHumanEdit && !(await ctx.store.findOpenWorkItem(ctx.tenantId, (w) => w.queue === "claim-edits" && w.claimId === next.id))) {
        const items = !second.clean
          ? itemsFromScrub(next, second.errors.length)
          : [makeWorkItem({ queue: "claim-edits", title: `Corrected claim ${next.id} needs a denial-specific fix before resubmission (CARC ${denialBefore.carc})`, patientId: next.patientId, claimId: next.id, amount: next.totalCharge, priority: 60, source: "system" })];
        await ctx.store.addWorkItems(ctx.tenantId, items);
      }
      const d = await ctx.store.getDenial(ctx.tenantId, input.denialId);
      // Keep the denial "in-progress" (not "appealed") even when the corrected claim is clean:
      // staging a claim for resubmission is not the same as the appeal actually reaching the
      // payer, and the claim still has to clear its own approval-gated submit-claim step. The
      // claim's resolvesDenialId lets submit-claim advance this denial to "appealed" once the
      // corrected claim is actually submitted.
      if (d) await ctx.store.upsertDenial(ctx.tenantId, { ...d, status: "in-progress" });
      return { correctedClaimId: next.id, clean: second.clean, autoFixed: fixed.applied };
    } finally {
      denialActionLocks.delete(lockKey);
    }
  },
};
const sendAppeal: Tool<{ denialId: string; claimId: string; amount: number }, unknown> = {
  name: "send-appeal",
  description: "Send the appeal packet to the payer",
  requiresApproval: true,
  approvalReason: "payer-facing appeal",
  async run(input, ctx) {
    const lockKey = `${ctx.tenantId}:${input.denialId}`;
    if (denialActionLocks.has(lockKey)) throw new Error("Another action on this denial is already in flight");
    denialActionLocks.add(lockKey);
    try {
      const d = await ctx.store.getDenial(ctx.tenantId, input.denialId);
      if (!d) throw new Error("denial not found");
      if (d.status !== "open") throw new Error(`Denial ${d.id} is no longer open (status: ${d.status}) — this approval is stale`);
      const claim = await ctx.store.getClaim(ctx.tenantId, d.claimId);
      if (!claim) throw new Error("claim not found");
      // There's no real payer/clearinghouse adapter behind this stub environment (the same
      // boundary submit-claim documents as "837P sent (stub clearinghouse)") — but unlike
      // submit-claim, nothing here previously left ANY artifact of what was supposedly sent, so
      // an approval could move a denial out of the open queue with literally nothing produced to
      // mail/fax/upload. Actually generate the letter and stage it as a durable, visible work item.
      const patient = await ctx.store.getPatient(ctx.tenantId, claim.patientId);
      const letter = generateAppealLetter({ denial: d, claim, patientName: patient ? `${patient.firstName} ${patient.lastName}` : "Patient", providerName: claim.renderingProviderName ?? "Rendering Provider", practiceName: "World EHR Outpatient" });
      await ctx.store.upsertDenial(ctx.tenantId, { ...d, status: "appealed" });
      if (["denied", "partially-paid", "paid"].includes(claim.status)) await ctx.store.upsertClaim(ctx.tenantId, transitionClaim(claim, "appealed", ctx.actor));
      await ctx.store.addWorkItems(ctx.tenantId, [makeWorkItem({ queue: "denials", title: `Appeal packet ready to send — denial ${d.id} (${letter.level})`, patientId: claim.patientId, claimId: claim.id, amount: d.amount, priority: 70, source: "system", context: { letter: letter.letter, level: letter.level, deadline: letter.deadline } })]);
      return { appealed: d.id, level: letter.level };
    } finally {
      denialActionLocks.delete(lockKey);
    }
  },
};
const writeOffDenial: Tool<{ denialId: string; patientId: string; amount: number; reason: string }, unknown> = {
  name: "write-off",
  description: "Post a denial write-off to the ledger",
  requiresApproval: true,
  approvalReason: "adjustment reduces receivable",
  async run(input, ctx) {
    const lockKey = `${ctx.tenantId}:${input.denialId}`;
    if (denialActionLocks.has(lockKey)) throw new Error("Another action on this denial is already in flight");
    // denialActionLocks alone only serializes actions on THIS denial — two different open denials
    // on the SAME claim (e.g. two separate CARC lines from one ERA) can each hold their own denial
    // lock and both read the same pre-mutation outstandingInsurance balance before either posts,
    // together writing off more than the claim's one actual receivable. Also take the shared
    // patientLedgerLocks lock (same one /ledger, /remittance/post, and issue-refund/
    // small-balance-write-off use) so any two balance-read-then-ledger-write actions for this
    // patient — including two denials on the same claim — serialize against each other too.
    const patientLockKey = `${ctx.tenantId}:${input.patientId}`;
    if (patientLedgerLocks.has(patientLockKey)) throw new Error("Another ledger action for this patient is already in flight");
    denialActionLocks.add(lockKey);
    patientLedgerLocks.add(patientLockKey);
    try {
      const d = await ctx.store.getDenial(ctx.tenantId, input.denialId);
      if (!d) throw new Error("denial not found");
      // An approval can sit pending/approved-but-unexecuted for a while — revalidate the denial is
      // still open right before posting, so a stale approval can't double-adjust a denial that
      // another action (or a human) already resolved in the meantime.
      if (d.status !== "open") throw new Error(`Denial ${d.id} is no longer open (status: ${d.status}) — this approval is stale`);
      // The approval payload supplies patientId independently of denialId — without this, a
      // mismatched or drifted payload would take patientLedgerLocks for the WRONG patient and
      // still post against the denial's real account, bypassing the same-claim over-write-off
      // race that lock is meant to close. Same class of check as file-corrected-claim's
      // denial.claimId vs input.claimId.
      if (d.patientId !== input.patientId) throw new Error(`Denial ${input.denialId} does not belong to patient ${input.patientId}`);
      const claim = await ctx.store.getClaim(ctx.tenantId, d.claimId);
      if (!claim) throw new Error("claim not found");
      // d.amount is captured when the denial was created and can be stale by execution time (a
      // malformed/duplicated CAS, or other postings against this claim since) — cap it against
      // what's actually still outstanding on the insurance side so this can never post more than
      // the claim genuinely owes and turn a write-off into a fabricated insurance credit.
      const outstanding = outstandingInsurance(claim, await ctx.store.ledger(ctx.tenantId, d.patientId));
      const amount = round2(Math.min(d.amount, Math.max(0, outstanding)));
      if (amount <= 0) throw new Error(`No outstanding insurance balance remains on claim ${claim.id} to write off`);
      const e: LedgerEntry = { id: newId("led"), patientId: d.patientId, claimId: d.claimId, type: "denial-adjustment", amount, date: todayIso(), memo: `Write-off CARC ${d.carc}: ${input.reason}`, responsibleParty: "insurance" };
      await ctx.store.postLedger(ctx.tenantId, [e]);
      await ctx.store.upsertDenial(ctx.tenantId, { ...d, status: "written-off" });
      return { writtenOff: amount };
    } finally {
      denialActionLocks.delete(lockKey);
      patientLedgerLocks.delete(patientLockKey);
    }
  },
};
const transferToPatient: Tool<{ denialId: string; patientId: string; amount: number }, unknown> = {
  name: "transfer-to-patient",
  description: "Move a PR-group amount to patient responsibility",
  requiresApproval: true,
  approvalReason: "increases what the patient owes",
  async run(input, ctx) {
    const lockKey = `${ctx.tenantId}:${input.denialId}`;
    if (denialActionLocks.has(lockKey)) throw new Error("Another action on this denial is already in flight");
    // Same reasoning as write-off above — denialActionLocks doesn't cover a second, different
    // open denial racing on the same claim, so also take the shared patientLedgerLocks lock.
    const patientLockKey = `${ctx.tenantId}:${input.patientId}`;
    if (patientLedgerLocks.has(patientLockKey)) throw new Error("Another ledger action for this patient is already in flight");
    denialActionLocks.add(lockKey);
    patientLedgerLocks.add(patientLockKey);
    try {
      const d = await ctx.store.getDenial(ctx.tenantId, input.denialId);
      if (!d) throw new Error("denial not found");
      if (d.status !== "open") throw new Error(`Denial ${d.id} is no longer open (status: ${d.status}) — this approval is stale`);
      // Same check as write-off above: the lock is keyed on the payload's patientId, so a
      // mismatch would serialize the wrong patient and still mutate the denial's account.
      if (d.patientId !== input.patientId) throw new Error(`Denial ${input.denialId} does not belong to patient ${input.patientId}`);
      // This tool only moves genuine patient-responsibility (CARC group "PR") amounts onto the
      // patient — a CO/OA/PI adjustment is a contractual write-off or other insurance-side
      // outcome, never something the patient actually owes, and approving this action must not be
      // able to convert one into a patient balance.
      if (d.group !== "PR") throw new Error(`Denial ${d.id} is group "${d.group}", not patient responsibility (PR) — use write-off instead`);
      const claim = await ctx.store.getClaim(ctx.tenantId, d.claimId);
      if (!claim) throw new Error("claim not found");
      // Same reasoning as write-off above: d.amount can be stale by execution time, so cap it
      // against what's actually still outstanding on the insurance side before moving it to the
      // patient — otherwise this could transfer more than the claim genuinely still owes.
      const outstanding = outstandingInsurance(claim, await ctx.store.ledger(ctx.tenantId, d.patientId));
      const amount = round2(Math.min(d.amount, Math.max(0, outstanding)));
      if (amount <= 0) throw new Error(`No outstanding insurance balance remains on claim ${claim.id} to transfer`);
      await ctx.store.postLedger(ctx.tenantId, [{ id: newId("led"), patientId: d.patientId, claimId: d.claimId, type: "transfer-to-patient", amount, date: todayIso(), memo: `CARC ${d.carc} patient responsibility`, responsibleParty: "patient" }]);
      await ctx.store.upsertDenial(ctx.tenantId, { ...d, status: "written-off" });
      return { transferred: amount };
    } finally {
      denialActionLocks.delete(lockKey);
      patientLedgerLocks.delete(patientLockKey);
    }
  },
};
const denialAgent: AgentDefinition = {
  name: "denials",
  description: "Triages every open denial by dollars × remediability × deadline, drafts appeals, and stages corrected claims / write-offs for approval.",
  tools: [triageDenial, fileCorrectedClaim, sendAppeal, writeOffDenial, transferToPatient],
  async plan(ctx) {
    const steps: AgentStep[] = [];
    const open = (await ctx.store.listDenials(ctx.tenantId, "open")).sort((a, b) => b.priorityScore - a.priorityScore);
    // Planning must stay read-only under dryRun — this queue write is a real side effect, not
    // a step the runtime's own dryRun branch can intercept (planning runs before that branch).
    if (!ctx.dryRun) {
      const highPriority = open.filter((d) => d.priorityScore >= 60);
      const withoutOpenItem: typeof highPriority = [];
      for (const d of highPriority) {
        const existing = await ctx.store.findOpenWorkItem(ctx.tenantId, (w) => w.queue === "denials" && w.context?.denialId === d.id);
        if (!existing) withoutOpenItem.push(d);
      }
      if (withoutOpenItem.length) await ctx.store.addWorkItems(ctx.tenantId, itemsFromDenials(withoutOpenItem));
    }
    for (const d of open) {
      steps.push({ tool: "triage-denial", input: { denialId: d.id }, why: `${d.category} CARC ${d.carc}` });
      const rec = recommendAction(d);
      const base = { denialId: d.id, claimId: d.claimId, patientId: d.patientId, amount: d.amount };
      if (rec.action === "corrected-claim") steps.push({ tool: "file-corrected-claim", input: base, why: rec.reason });
      else if (rec.action === "appeal") steps.push({ tool: "send-appeal", input: base, why: rec.reason });
      else if (rec.action === "write-off") steps.push({ tool: "write-off", input: { ...base, reason: rec.reason }, why: rec.reason });
      else if (rec.action === "bill-patient") steps.push({ tool: "transfer-to-patient", input: base, why: rec.reason });
    }
    return steps;
  },
  summarize: (s) => `Denials: ${s.filter((x) => x.tool === "triage-denial").length} triaged, ${s.filter((x) => x.outcome === "needs-approval").length} actions awaiting approval, ${s.filter((x) => x.tool === "transfer-to-patient" && x.outcome === "ok").length} moved to patient responsibility.`,
};

// ---------- Patient financial agent ----------
const sendStatement: Tool<{ patientId: string; cycle: 1 | 2 | 3 | "final" }, unknown> = {
  name: "send-statement",
  description: "Generate and deliver a patient statement via the propensity-recommended channel",
  async run(input, ctx) {
    const p = await ctx.store.getPatient(ctx.tenantId, input.patientId);
    if (!p) throw new Error("patient not found");
    const stmt = buildStatement(p, await ctx.store.ledger(ctx.tenantId, p.id), input.cycle);
    const ptp = propensityToPay({ balance: stmt.amountDue, priorStatementsPaidOnTime: 0, priorStatementsLate: 0, hasCardOnFile: false });
    return { amountDue: stmt.amountDue, channel: ptp.recommendedChannel, cycle: stmt.cycle };
  },
};
// Uses the shared paymentPlanLocks lock from patient-financials.ts (also used by the direct
// POST /patients/:id/payment-plan route) — a lock private to just this tool wouldn't serialize
// against that route creating a plan for the same patient at the same time. Closes the
// check-then-insert TOCTOU race in run() below: two concurrent runs (a manual trigger overlapping
// the nightly cycle, or two nightly triggers) could each plan() against the same pre-run snapshot
// of existingPlans, both see "no active plan" for a patient, and each execute an
// offer-payment-plan step before either's insert lands — stacking two plans against the same
// balance. plan()'s own hasActivePlan check can't prevent this by itself since it only ever sees
// a snapshot taken before either run started.
const offerPlan: Tool<{ patientId: string; amount: number; months: number }, unknown> = {
  name: "offer-payment-plan",
  description: "Create a payment plan offer",
  async run(input, ctx) {
    const lockKey = `${ctx.tenantId}:${input.patientId}`;
    if (paymentPlanLocks.has(lockKey)) throw new Error("A payment plan action for this patient is already in flight");
    paymentPlanLocks.add(lockKey);
    try {
      // Recheck at execution time, not just at plan() time — a plan offered or accepted by
      // another run between planning and this step's execution must block a duplicate here.
      const existing = await ctx.store.listPaymentPlans(ctx.tenantId, input.patientId);
      if (existing.some((pp) => pp.schedule.some((s) => s.status !== "paid"))) throw new Error("Patient already has an active payment plan");
      const plan = await ctx.store.upsertPaymentPlan(ctx.tenantId, createPaymentPlan(input.patientId, input.amount, input.months));
      return { planId: plan.id, installment: plan.installment, months: plan.months };
    } finally {
      paymentPlanLocks.delete(lockKey);
    }
  },
};
const referToAgency: Tool<{ patientId: string; amount: number }, unknown> = {
  name: "refer-to-agency",
  description: "Refer a 120+ day balance to collections",
  requiresApproval: true,
  approvalReason: "external collections referral",
  async run(input, ctx) { await ctx.store.addWorkItems(ctx.tenantId, [makeWorkItem({ queue: "patient-balance", title: `Agency referral executed $${input.amount.toFixed(2)}`, patientId: input.patientId, amount: input.amount, priority: 30, source: "agent" })]); return { referred: input.amount }; },
};
// Uses the shared patientLedgerLocks lock from patient-financials.ts (also used by the direct
// POST /ledger and POST /remittance/post routes) — see its comment there for why a lock private to
// just this module isn't enough: two approved actions for the SAME patient (two refunds, two
// write-offs, one of each, or a race against a direct ledger/remittance post) could otherwise each
// read the same pre-mutation balance before either writes. The runtime's own `executing` lock is
// keyed by approval id, not patient, so it doesn't close this gap either.
const issueRefund: Tool<{ patientId: string; amount: number; refundTo: string }, unknown> = {
  name: "issue-refund",
  description: "Refund a credit balance",
  requiresApproval: true,
  approvalReason: "money leaves the practice",
  async run(input, ctx) {
    const lockKey = `${ctx.tenantId}:${input.patientId}`;
    if (patientLedgerLocks.has(lockKey)) throw new Error("Another ledger action for this patient is already in flight");
    patientLedgerLocks.add(lockKey);
    try {
      // Recompute the credit at execution time — planning and approval can lag behind other
      // activity on the account (a payment, another refund), and posting the stale planned amount
      // could refund money that's no longer there and turn the account into a debit.
      const entries = await ctx.store.ledger(ctx.tenantId, input.patientId);
      const availableCredit = round2(Math.max(0, -computeAccount(input.patientId, entries).balance));
      if (availableCredit <= 0) throw new Error("no credit balance remains to refund");
      const amount = round2(Math.min(input.amount, availableCredit));
      await ctx.store.postLedger(ctx.tenantId, [{ id: newId("led"), patientId: input.patientId, type: "refund", amount, date: todayIso(), memo: `Refund to ${input.refundTo}`, responsibleParty: input.refundTo === "payer" ? "insurance" : "patient" }]);
      return { refunded: amount };
    } finally {
      patientLedgerLocks.delete(lockKey);
    }
  },
};
const smallBalanceWriteOff: Tool<{ patientId: string; amount: number }, unknown> = {
  name: "small-balance-write-off",
  description: "Write off balances under the policy threshold",
  requiresApproval: true,
  approvalReason: "adjustment forgives a patient receivable",
  async run(input, ctx) {
    const lockKey = `${ctx.tenantId}:${input.patientId}`;
    if (patientLedgerLocks.has(lockKey)) throw new Error("Another ledger action for this patient is already in flight");
    patientLedgerLocks.add(lockKey);
    try {
      // Recompute the balance at execution, same as issue-refund — a payment or another
      // adjustment can land between planning and approval, and posting the stale planned amount
      // could write off more than the patient actually still owes.
      const entries = await ctx.store.ledger(ctx.tenantId, input.patientId);
      const currentBalance = computeAccount(input.patientId, entries).patientBalance;
      if (currentBalance <= 0) throw new Error("no patient balance remains to write off");
      const amount = round2(Math.min(input.amount, currentBalance));
      await ctx.store.postLedger(ctx.tenantId, [{ id: newId("led"), patientId: input.patientId, type: "write-off", amount, date: todayIso(), memo: "Small-balance policy write-off", responsibleParty: "patient" }]);
      return { writtenOff: amount };
    } finally {
      patientLedgerLocks.delete(lockKey);
    }
  },
};
const patientFinancialAgent: AgentDefinition = {
  name: "patient-financial",
  description: "Runs the patient A/R cycle: statements by propensity channel, payment-plan offers, small-balance write-offs, credit-balance refunds and agency referrals (both approval-gated).",
  tools: [sendStatement, offerPlan, referToAgency, issueRefund, smallBalanceWriteOff],
  async plan(ctx) {
    const steps: AgentStep[] = [];
    const byPatient = await ctx.store.ledgerByPatient(ctx.tenantId);
    // A plan with any schedule entry not yet paid is still active — don't offer a second one or
    // keep escalating collections for a patient who is already paying one down.
    const existingPlans = await ctx.store.listPaymentPlans(ctx.tenantId);
    const hasActivePlan = (patientId: string) => existingPlans.some((pp) => pp.patientId === patientId && pp.schedule.some((s) => s.status !== "paid"));
    for (const w of smallBalanceWriteOffs(byPatient)) steps.push({ tool: "small-balance-write-off", input: w, why: "below $5 policy threshold" });
    for (const c of detectCreditBalances(byPatient)) steps.push({ tool: "issue-refund", input: { patientId: c.patientId, amount: c.amount, refundTo: c.refundTo }, why: `${c.source} credit balance` });
    for (const [patientId, entries] of Object.entries(byPatient)) {
      const p = await ctx.store.getPatient(ctx.tenantId, patientId);
      if (!p) continue;
      const stmt = buildStatement(p, entries);
      if (stmt.amountDue <= 5) continue;
      const onPlan = hasActivePlan(patientId);
      // A self-pay balance never gets a transfer-to-patient entry — responsibleParty puts it on
      // the patient side from the charge itself (patient-financials.ts's computeAccount). Falling
      // back straight to todayIso() here would reset the collections clock to "day zero" on every
      // nightly run, permanently pinning these accounts at statement-1 and never escalating to
      // later cycles or agency referral. Fall back to the earliest self-pay charge date instead.
      const firstTransfer = entries.filter((e) => e.type === "transfer-to-patient").sort((a, b) => a.date.localeCompare(b.date))[0];
      const firstSelfPayCharge = entries.filter((e) => e.type === "charge" && e.responsibleParty === "patient").sort((a, b) => a.date.localeCompare(b.date))[0];
      const stage = collectionsStage(firstTransfer?.date ?? firstSelfPayCharge?.date ?? todayIso(), { onPaymentPlan: onPlan });
      if (stage.stage === "agency-referral") steps.push({ tool: "refer-to-agency", input: { patientId, amount: stmt.amountDue }, why: stage.reason });
      else if (stage.stage !== "hold") {
        const cycle: 1 | 2 | 3 | "final" = stage.stage === "statement-1" ? 1 : stage.stage === "statement-2" ? 2 : stage.stage === "statement-3" ? 3 : "final";
        steps.push({ tool: "send-statement", input: { patientId, cycle }, why: stage.reason });
        if (!onPlan && stmt.amountDue >= 200) steps.push({ tool: "offer-payment-plan", input: { patientId, amount: stmt.amountDue, months: Math.min(12, Math.ceil(stmt.amountDue / 50)) }, why: "balance ≥ $200" });
      }
    }
    return steps;
  },
  summarize: (s) => `Patient financial: ${s.filter((x) => x.tool === "send-statement" && x.outcome === "ok").length} statements, ${s.filter((x) => x.tool === "offer-payment-plan" && x.outcome === "ok").length} plan offers, ${s.filter((x) => x.outcome === "needs-approval").length} refunds/referrals awaiting approval.`,
};

// ---------- Payer call (voice) agent ----------
const prepareCall: Tool<{ claimId: string }, unknown> = {
  name: "prepare-payer-call",
  description: "Build an IVR-ready call script + expected answers for a claim follow-up call",
  async run(input, ctx) {
    const claim = await ctx.store.getClaim(ctx.tenantId, input.claimId);
    if (!claim) throw new Error("claim not found");
    const coverage = await ctx.store.getCoverage(ctx.tenantId, claim.coverageId);
    const patient = await ctx.store.getPatient(ctx.tenantId, claim.patientId);
    return buildPayerCallScript(claim, coverage, patient);
  },
};
const payerCallAgent: AgentDefinition = {
  name: "payer-call",
  description: "Prepares voice-agent call scripts (IVR navigation, verification, questions, disposition capture) for every claim in the follow-up queue.",
  tools: [prepareCall],
  async plan(ctx) {
    const items = (await ctx.store.listWorkItems(ctx.tenantId, "claim-followup")).filter((w) => w.status === "open" && w.claimId);
    return items.map((w) => ({ tool: "prepare-payer-call", input: { claimId: w.claimId! }, why: w.title }));
  },
  summarize: (s) => `Payer call: ${s.filter((x) => x.outcome === "ok").length} call scripts prepared.`,
};

// ---------- Orchestrator (nightly cycle) ----------
const runAgent: Tool<{ agent: string }, unknown> = {
  name: "run-agent",
  description: "Run a child agent",
  async run(input, ctx) { const r = await agentRuntime.run(input.agent, ctx.tenantId, {}, { actor: ctx.actor, dryRun: ctx.dryRun, budget: ctx.budget }); return { summary: r.summary, approvals: r.approvalsRequested }; },
};
const snapshotKpis: Tool<Record<string, never>, unknown> = {
  name: "snapshot-kpis",
  description: "Compute KPIs and flag critical ones as work",
  async run(_i, ctx) {
    const stats = await ctx.store.scrubStats(ctx.tenantId);
    const kpis = computeKpis({ claims: await ctx.store.listClaims(ctx.tenantId), denials: await ctx.store.listDenials(ctx.tenantId), ledger: await ctx.store.ledger(ctx.tenantId), remittances: await ctx.store.listRemittances(ctx.tenantId), scrubTotal: stats.total, scrubFirstPassClean: stats.firstPassClean, chargeEntryLagDays: await ctx.store.chargeLagSamples(ctx.tenantId) });
    const critical = kpis.filter((k) => k.status === "critical");
    return { critical: critical.map((k) => k.key), kpis: kpis.map((k) => ({ key: k.key, value: k.value, status: k.status })) };
  },
};
const orchestrator: AgentDefinition = {
  name: "rcm-orchestrator",
  description: "Nightly revenue-cycle run: eligibility → prior-auth → scrubber → follow-up → denials → patient financial → payer-call → KPI snapshot.",
  tools: [runAgent, snapshotKpis],
  async plan() { return [...["eligibility", "prior-auth", "claim-scrubber", "claim-followup", "denials", "patient-financial", "payer-call"].map((agent) => ({ tool: "run-agent", input: { agent }, why: "nightly cycle" })), { tool: "snapshot-kpis", input: {}, why: "end-of-cycle metrics" }]; },
  summarize: (s) => s.filter((x) => x.tool === "run-agent" && x.outcome === "ok").map((x) => (x.output as { summary: string }).summary).join(" "),
};

export function registerRcmAgents(): void {
  for (const a of [eligibilityAgent, priorAuthAgent, scrubberAgent, followUpAgent, denialAgent, patientFinancialAgent, payerCallAgent, orchestrator]) agentRuntime.register(a);
}
registerRcmAgents();

export { agentRuntime };
export type { ToolContext, Claim };
