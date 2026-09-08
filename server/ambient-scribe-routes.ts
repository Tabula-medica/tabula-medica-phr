/**
 * HTTP surface for the ambient scribe.
 *
 * Six routes, and the order they can be called in is the safety model:
 *
 * ```
 * POST /consent          capture, or withdraw, permission to record
 * POST /session          start — refuses on consent, language or residency
 * POST /session/:id/draft   transcript in, evidence-linked draft out
 * GET  /session/:id      review the draft against the words behind it
 * POST /session/:id/attest  a named clinician signs; only now is it a record
 * POST /session/:id/bundle  attested note out as an ABDM OP Consultation Record
 * ```
 *
 * There is no path from transcript to bundle that skips attestation, and
 * `buildOpConsultBundle` throws rather than returns if one is ever found.
 *
 * ## Every route is clinic staff, and that is not sufficient on its own
 *
 * `requireClinicStaff` answers "is this a clinician account". It does not
 * answer "does this clinician have any business with this patient", and the
 * middleware's own docstring says so. That distinction bit this branch once
 * already: clinic-initiated share minting took a caller-supplied `profileId`
 * behind nothing but a role check and had to be refused outright.
 *
 * The scribe is a different shape and the role check is the right boundary
 * here, for one specific reason: **a scribe session does not open an existing
 * record.** It creates new content from a conversation happening in the room
 * the caller is standing in. A clinician who fabricates a session for a
 * patient they are not treating gains nothing they did not already have to
 * type in themselves. Reading back is where the asymmetry returns, so
 * `GET /session/:id` is restricted to the clinician who created it.
 */

import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { isAuthenticated } from "./replit_integrations/auth";
import { noStorePhi } from "./lib/middleware/no-store-phi";
import { requireClinicStaff, callerFrom } from "./lib/middleware/require-clinic-staff";
import { logPhiAccess } from "./security/hipaa-audit";
import { SCRIBE_LIMITS } from "@shared/ambient-scribe";
import {
  EIGHTH_SCHEDULE_LANGUAGES,
  INDIA_LANGUAGES,
  COMMON_CODE_MIXES,
} from "@shared/india-languages";
import { INDIA_COPY_COVERAGE } from "./services/engagement/summary-strings";
import { resolveScribeLanguage, speechAllowList, hasWrittenCopy } from "./services/ambient-scribe/language-support";
import { checkResidency } from "./services/ambient-scribe/residency";
import {
  evaluateRecordingConsent,
  withdrawalEffect,
  NOTICE_ELEMENTS,
  type RecordingConsent,
} from "./services/ambient-scribe/consent";
import { normaliseTurns, assignSpeakerRoles, buildTranscript } from "./services/ambient-scribe/transcript";
import { buildNoteDraft, evidenceText } from "./services/ambient-scribe/note-builder";
import { buildOpConsultBundle, NotAttestedError } from "./services/ambient-scribe/abdm-bundle";
import { scribeStore } from "./services/ambient-scribe/scribe-store";

/**
 * Tighter than the general API limiter.
 *
 * Each of these calls carries a consultation transcript, so the cost of a
 * request is much higher than a typical read and the legitimate rate is much
 * lower — a clinician runs one session per patient, not one per second.
 */
const scribeRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many scribe requests" },
});

const consentSchema = z.object({
  profileId: z.string().uuid(),
  jurisdiction: z.string().min(2).max(2),
  state: z.enum(["granted", "refused", "withdrawn"]),
  method: z.enum(["verbal-attested", "written", "patient-device"]),
  noticeLanguage: z.string().min(2).max(8),
  noticeVersion: z.string().min(1).max(64),
  noticeElements: z.array(z.enum(NOTICE_ELEMENTS)).default([]),
});

const startSchema = z.object({
  profileId: z.string().uuid(),
  jurisdiction: z.string().min(2).max(2),
  language: z.string().min(2).max(8),
  mixedWith: z.array(z.string().min(2).max(8)).max(3).default([]),
});

const turnSchema = z.object({
  speakerTag: z.number().int().min(0).max(16),
  text: z.string().max(8000),
  language: z.string().min(2).max(16),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
  confidence: z.number().min(0).max(1),
});

const draftSchema = z.object({
  engine: z.string().min(1).max(120),
  turns: z.array(turnSchema).min(1).max(5000),
  /** Established out-of-band. Absent means roles are unknown, not guessable. */
  clinicianSpeakerTag: z.number().int().min(0).max(16).optional(),
  companionSpeakerTags: z.array(z.number().int().min(0).max(16)).max(4).default([]),
});

const attestSchema = z.object({
  clinicianName: z.string().min(1).max(200),
  editedItemCount: z.number().int().min(0).default(0),
  removedItemCount: z.number().int().min(0).default(0),
});

const bundleSchema = z.object({
  patientName: z.string().min(1).max(200),
  clinicianName: z.string().min(1).max(200),
  sectionCodes: z
    .record(z.object({ system: z.string(), code: z.string(), display: z.string() }))
    .optional(),
});

/**
 * Consent, re-checked on a session that already exists.
 *
 * Round 10 found that only session start and draft-building asked. Reading a
 * draft back, attesting it, and exporting it as an ABDM document all skipped
 * the question, so a transcript captured before a withdrawal could still be
 * signed into a clinical record and exchanged afterwards.
 *
 * Withdrawal now purges unattested content the moment it is recorded, so in
 * practice these handlers find nothing to serve. This guard is the second
 * line: a draft written in the window between the withdrawal landing and this
 * request arriving would otherwise slip through, and "the other check already
 * handles it" is how the first gap got here.
 */
async function consentStillStands(profileId: string) {
  const onFile = await scribeStore().findConsent(profileId, "ambient-documentation");
  return evaluateRecordingConsent(onFile, "ambient-documentation");
}

export function registerAmbientScribeRoutes(app: Express): void {
  /**
   * What this deployment can actually do, before anyone tries.
   *
   * Open to any signed-in caller because it discloses configuration, not
   * patients. It exists so a client can grey out the languages that will
   * refuse rather than letting a clinician start a consultation and discover
   * mid-visit that the scribe will not run.
   */
  app.get(
    "/api/scribe/capabilities",
    isAuthenticated,
    scribeRateLimiter,
    (_req: Request, res: Response) => {
      const speech = speechAllowList();
      res.json({
        eighthScheduleLanguages: EIGHTH_SCHEDULE_LANGUAGES.map((l) => ({
          code: l.code,
          name: l.name,
          nativeName: l.nativeName,
          script: l.script,
          direction: l.direction,
          speechTag: l.speechTag,
          speechEnabled: speech.includes(l.code),
          writtenCopy: hasWrittenCopy(l.code),
        })),
        englishAlso: INDIA_LANGUAGES.filter((l) => !l.eighthSchedule).map((l) => l.code),
        codeMixPairs: COMMON_CODE_MIXES,
        writtenCopyCoverage: INDIA_COPY_COVERAGE,
        limits: SCRIBE_LIMITS,
        noticeElementsRequired: NOTICE_ELEMENTS,
        /** Empty means nothing is enabled and every session will refuse. */
        speechEnabledCount: speech.length,
      });
    },
  );

  /** Capture, or withdraw, permission to record. */
  app.post(
    "/api/scribe/consent",
    isAuthenticated,
    requireClinicStaff("The ambient scribe"),
    noStorePhi,
    scribeRateLimiter,
    async (req: Request, res: Response) => {
      const parsed = consentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid consent", detail: parsed.error.flatten() });
      }
      const caller = callerFrom(req);
      const body = parsed.data;

      const consent: RecordingConsent = {
        patientId: body.profileId,
        jurisdiction: body.jurisdiction.toUpperCase(),
        purpose: "ambient-documentation",
        state: body.state,
        method: body.method,
        noticeLanguage: body.noticeLanguage,
        noticeVersion: body.noticeVersion,
        noticeElements: body.noticeElements,
        capturedAt: new Date().toISOString(),
        capturedBy: caller.userId,
        ...(body.state === "withdrawn" ? { withdrawnAt: new Date().toISOString() } : {}),
      };

      await scribeStore().putConsent(consent);

      await logPhiAccess({
        userId: caller.userId!,
        patientId: body.profileId,
        resourceType: "scribe-consent",
        action: "write",
        details: `recording consent ${body.state} via ${body.method}`,
      });

      // Withdrawal is not a flag, and it is not a policy statement either.
      // This used to return `withdrawalEffect(false)` — an object asserting
      // `deleteDraft: true` — while destroying nothing, so an unattested
      // transcript survived and could still be attested and exported. The
      // destruction now happens here, and the response reports what was
      // actually done rather than what the policy says should be.
      if (body.state !== "withdrawn") {
        return res.json({ ok: true, state: body.state });
      }

      const applied = await scribeStore().applyWithdrawal(body.profileId);

      await logPhiAccess({
        userId: caller.userId!,
        patientId: body.profileId,
        resourceType: "scribe-session",
        action: "delete",
        details:
          `withdrawal purged ${applied.purgedDrafts} unattested session(s); ` +
          `${applied.attestedRetained} attested note(s) retained with transcript destroyed`,
      });

      res.json({
        ok: true,
        state: body.state,
        applied,
        policy: {
          unattested: withdrawalEffect(false),
          attested: withdrawalEffect(true),
        },
      });
    },
  );

  /** Start a session. Three gates, all refusing rather than defaulting. */
  app.post(
    "/api/scribe/session",
    isAuthenticated,
    requireClinicStaff("The ambient scribe"),
    noStorePhi,
    scribeRateLimiter,
    async (req: Request, res: Response) => {
      const parsed = startSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid session request", detail: parsed.error.flatten() });
      }
      const caller = callerFrom(req);
      const { profileId, language, mixedWith } = parsed.data;
      const jurisdiction = parsed.data.jurisdiction.toUpperCase();

      // 1. Residency first. Checked before anything reads or writes patient
      //    data, because a check that runs after the audio has been sent has
      //    already lost.
      const residency = checkResidency(jurisdiction);
      if (!residency.ok) {
        return res.status(503).json({ error: residency.reason, detail: residency.detail });
      }

      // 2. Consent. Not "is this patient contactable" — permission to capture
      //    this room, with a DPDP s.5 notice behind it.
      const onFile = await scribeStore().findConsent(profileId, "ambient-documentation");
      const consent = evaluateRecordingConsent(onFile, "ambient-documentation");
      if (!consent.ok) {
        return res.status(403).json({ error: consent.reason, detail: consent.detail });
      }

      // 3. Language. An unset speech allow-list refuses everything.
      const resolved = resolveScribeLanguage({ primary: language, mixedWith });
      if (!resolved.ok) {
        return res.status(422).json({ error: resolved.reason, detail: resolved.detail });
      }

      const session = await scribeStore().createSession({
        profileId,
        clinicianAccountId: caller.userId!,
        jurisdiction,
        language: resolved.language.code,
        mixedWith: resolved.mixedWith,
        processedInRegion: residency.region,
        draftExpiresAt: new Date(Date.now() + SCRIBE_LIMITS.DRAFT_TTL_HOURS * 3600_000),
      });

      await logPhiAccess({
        userId: caller.userId!,
        patientId: profileId,
        resourceType: "scribe-session",
        action: "write",
        details: `scribe session started in ${resolved.language.code}`,
      });

      res.status(201).json({
        sessionId: session.id,
        speechTag: resolved.speechTag,
        mixedWith: resolved.mixedWith,
        processedInRegion: residency.region,
        copyFallsBackToEnglish: resolved.copyFallsBackToEnglish,
        audioRetentionHours: SCRIBE_LIMITS.AUDIO_RETENTION_HOURS,
      });
    },
  );

  /** Transcript in, evidence-linked draft out. */
  app.post(
    "/api/scribe/session/:id/draft",
    isAuthenticated,
    requireClinicStaff("The ambient scribe"),
    noStorePhi,
    scribeRateLimiter,
    async (req: Request, res: Response) => {
      const parsed = draftSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid transcript", detail: parsed.error.flatten() });
      }
      const caller = callerFrom(req);
      const session = await scribeStore().getSession(req.params.id);
      if (!session || session.clinicianAccountId !== caller.userId) {
        // Same answer for "no such session" and "not yours": a distinguishable
        // 403 would confirm the id exists.
        return res.status(404).json({ error: "Session not found" });
      }
      if (session.attestation) {
        return res.status(409).json({
          error: "already-attested",
          detail:
            "This note has been signed. Replacing the transcript behind an attestation " +
            "would change what a clinician put their name to.",
        });
      }

      // Consent is re-checked here, not only at start. A patient can withdraw
      // mid-consultation, and the transcript arriving after that must not
      // become a note.
      const onFile = await scribeStore().findConsent(session.profileId, "ambient-documentation");
      const consent = evaluateRecordingConsent(onFile, "ambient-documentation");
      if (!consent.ok) {
        await scribeStore().purgeDraft(session.id);
        return res.status(403).json({
          error: consent.reason,
          detail: consent.detail,
          purged: true,
        });
      }

      const { turns: assigned, rolesEstablished } = assignSpeakerRoles(
        normaliseTurns(parsed.data.turns),
        {
          clinicianSpeakerTag: parsed.data.clinicianSpeakerTag,
          companionSpeakerTags: parsed.data.companionSpeakerTags,
        },
      );

      const built = buildTranscript({
        turns: assigned,
        primaryLanguage: session.language,
        engine: parsed.data.engine,
      });
      if (!built.ok) {
        return res.status(422).json({ error: built.reason, detail: built.detail });
      }

      const note = buildNoteDraft({
        sessionId: session.id,
        transcript: built.transcript,
        rolesEstablished,
        language: session.language,
        languageFallback: !hasWrittenCopy(session.language),
      });

      const saved = await scribeStore().saveDraft({
        id: session.id,
        transcript: built.transcript,
        draft: note.draft,
        rolesEstablished,
        engine: parsed.data.engine,
      });
      if (!saved) {
        return res.status(409).json({ error: "already-attested" });
      }

      await logPhiAccess({
        userId: caller.userId!,
        patientId: session.profileId,
        resourceType: "scribe-draft",
        action: "write",
        details: `draft built from ${built.transcript.turns.length} turns`,
      });

      res.json({
        draft: note.draft,
        needsReview: note.needsReview,
        limitations: note.limitations,
        rolesEstablished,
        observedLanguages: built.transcript.observedLanguages,
      });
    },
  );

  /**
   * Review: the draft, plus the words behind each item.
   *
   * The evidence ships with the draft rather than behind a second call.
   * Attestation is only meaningful if review is cheap, and a provenance trail
   * that requires a request per line gets skipped.
   */
  app.get(
    "/api/scribe/session/:id",
    isAuthenticated,
    requireClinicStaff("The ambient scribe"),
    noStorePhi,
    scribeRateLimiter,
    async (req: Request, res: Response) => {
      const caller = callerFrom(req);
      const session = await scribeStore().getSession(req.params.id);
      if (!session || session.clinicianAccountId !== caller.userId) {
        return res.status(404).json({ error: "Session not found" });
      }

      await logPhiAccess({
        userId: caller.userId!,
        patientId: session.profileId,
        resourceType: "scribe-session",
        action: "read",
      });

      // After a withdrawal the attested note survives — it is a record of care
      // that was delivered — but the transcript and any unsigned draft do not,
      // and neither does the evidence trail built from them. Reported rather
      // than returned as silently empty, so the clinician knows why the
      // provenance links stopped resolving.
      const stands = await consentStillStands(session.profileId);
      if (!stands.ok) {
        return res.json({
          id: session.id,
          status: session.status,
          language: session.language,
          rolesEstablished: session.rolesEstablished,
          draft: session.attestation ? (session.draft ?? null) : null,
          evidence: {},
          evidenceUnavailable: stands.reason,
          attestation: session.attestation ?? null,
          isClinicalRecord: Boolean(session.attestation),
          consent: { ok: false, reason: stands.reason, detail: stands.detail },
        });
      }

      const evidence =
        session.draft && session.transcript
          ? Object.fromEntries(
              session.draft.items.map((i) => [i.id, evidenceText(session.transcript!, i)]),
            )
          : {};

      res.json({
        id: session.id,
        status: session.status,
        language: session.language,
        rolesEstablished: session.rolesEstablished,
        draft: session.draft ?? null,
        evidence,
        attestation: session.attestation ?? null,
        isClinicalRecord: Boolean(session.attestation),
      });
    },
  );

  /** A named clinician signs. Only after this is the note a clinical record. */
  app.post(
    "/api/scribe/session/:id/attest",
    isAuthenticated,
    requireClinicStaff("The ambient scribe"),
    noStorePhi,
    scribeRateLimiter,
    async (req: Request, res: Response) => {
      const parsed = attestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid attestation", detail: parsed.error.flatten() });
      }
      const caller = callerFrom(req);
      const session = await scribeStore().getSession(req.params.id);
      if (!session || session.clinicianAccountId !== caller.userId) {
        return res.status(404).json({ error: "Session not found" });
      }
      if (!session.draft) {
        return res.status(409).json({
          error: "transcript-empty",
          detail: "There is no draft to attest. Build one from a transcript first.",
        });
      }

      // Signing is the step that turns a machine's reading of a conversation
      // into a clinical record. Doing it after the patient withdrew would
      // manufacture exactly the artefact withdrawal exists to prevent — and
      // it is not a new rule, only the documented one enforced at the point
      // it would otherwise be crossed.
      const stands = await consentStillStands(session.profileId);
      if (!stands.ok) {
        await scribeStore().purgeDraft(session.id);
        return res.status(403).json({ error: stands.reason, detail: stands.detail, purged: true });
      }

      const attested = await scribeStore().attest(session.id, {
        attestedBy: caller.userId!,
        attestedByName: parsed.data.clinicianName,
        attestedAt: new Date().toISOString(),
        editedItemCount: parsed.data.editedItemCount,
        removedItemCount: parsed.data.removedItemCount,
      });

      // Null means someone else's attestation landed first. Reported as a
      // conflict rather than silently overwritten — two signatures on one note
      // is a question about who is responsible, not a race to resolve.
      if (!attested) {
        return res.status(409).json({
          error: "already-attested",
          detail: "This note was signed by another request first.",
        });
      }

      await logPhiAccess({
        userId: caller.userId!,
        patientId: session.profileId,
        resourceType: "scribe-attestation",
        action: "write",
        details: `note attested; ${parsed.data.editedItemCount} edited, ${parsed.data.removedItemCount} removed`,
      });

      // The audio has no further purpose once the note is signed.
      await scribeStore().markAudioDeleted(session.id, new Date());

      res.json({
        ok: true,
        attestation: attested.attestation,
        isClinicalRecord: true,
        audioDeleted: true,
      });
    },
  );

  /** Attested note out as an ABDM OP Consultation Record. */
  app.post(
    "/api/scribe/session/:id/bundle",
    isAuthenticated,
    requireClinicStaff("The ambient scribe"),
    noStorePhi,
    scribeRateLimiter,
    async (req: Request, res: Response) => {
      const parsed = bundleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid bundle request", detail: parsed.error.flatten() });
      }
      const caller = callerFrom(req);
      const session = await scribeStore().getSession(req.params.id);
      if (!session || session.clinicianAccountId !== caller.userId) {
        return res.status(404).json({ error: "Session not found" });
      }
      if (!session.draft || !session.attestation) {
        return res.status(409).json({
          error: "not-attested",
          detail:
            "Refusing to emit an ABDM document from an unattested draft. Every consumer " +
            "downstream reads Composition.author as the clinician responsible for the " +
            "content, so that name has to belong to someone who reviewed it.",
        });
      }

      // Exporting is disclosure to a national exchange. A withdrawal that
      // stops capture but not export stops nothing that matters.
      const stands = await consentStillStands(session.profileId);
      if (!stands.ok) {
        return res.status(403).json({ error: stands.reason, detail: stands.detail });
      }

      try {
        const result = buildOpConsultBundle({
          draft: session.draft,
          attestation: session.attestation,
          patient: { id: session.profileId, name: parsed.data.patientName },
          practitioner: { id: session.attestation.attestedBy, name: parsed.data.clinicianName },
          sectionCodes: parsed.data.sectionCodes,
        });

        await logPhiAccess({
          userId: caller.userId!,
          patientId: session.profileId,
          resourceType: "scribe-bundle",
          action: "export",
          details: `OP Consultation Record emitted (${result.assurance})`,
        });

        res.json(result);
      } catch (err) {
        if (err instanceof NotAttestedError) {
          return res.status(409).json({ error: "not-attested", detail: err.message });
        }
        throw err;
      }
    },
  );
}
