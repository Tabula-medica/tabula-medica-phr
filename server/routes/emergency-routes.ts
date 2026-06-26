import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "crypto";
import { db } from "../db";
import { profiles, auditLogTable } from "@shared/schema";
import { isAuthenticated } from "../replit_integrations/auth";
import { resolveAccountId } from "../middleware/require-phi-access";
import { encryptPhi, decryptPhi, isEncrypted } from "../security/phi-encryption";
import { ObjectStorageService } from "../replit_integrations/object_storage/objectStorage";

/**
 * Emergency Info + Break-Glass Single-Use Share
 *
 * Extends the existing patient-contacts feature. Emergency info lives inside
 * the existing `profiles.metadata` jsonb column under `metadata.emergency`,
 * and share tokens under `metadata.emergencyTokens`. NO migration.
 *
 * PHI string values are encrypted at rest with AES-256-GCM via
 * encryptPhi/decryptPhi. fileKeys, booleans and dates stay plaintext.
 *
 * Authenticated routes verify the target profile's accountId belongs to the
 * caller (resolveAccountId) before any read/write. Decrypted PHI is NEVER
 * logged. The public redeem route writes an audit row for every access.
 */

// ---------------------------------------------------------------------------
// Routers: `router` mounts under /api/patient-contacts (authenticated).
//          `publicRouter` mounts under /api/emergency (NO auth — break-glass).
// ---------------------------------------------------------------------------
const router = Router();
export const publicRouter = Router();

const objectStorage = new ObjectStorageService();

interface AuthRequest extends Request {
  user?: {
    claims?: {
      sub: string;
      email?: string;
    };
  };
}

// ---- Validation -----------------------------------------------------------

const MAX_LEN = 200;
const MAX_LONG = 5000;

const shortStr = z
  .string()
  .trim()
  .max(MAX_LEN, `Must be ${MAX_LEN} characters or fewer`)
  .optional()
  .or(z.literal(""));

const longStr = z
  .string()
  .trim()
  .max(MAX_LONG, `Must be ${MAX_LONG} characters or fewer`)
  .optional()
  .or(z.literal(""));

const phoneStr = z
  .string()
  .trim()
  .max(MAX_LEN)
  .regex(/^[0-9+()\-.\s]{3,}$/, "Invalid phone number")
  .optional()
  .or(z.literal(""));

const directiveType = z
  .enum(["dnr", "living_will", "healthcare_proxy", "other"])
  .optional()
  .or(z.literal(""));

const emergencySchema = z.object({
  bloodType: shortStr,
  allergiesSummary: longStr,
  criticalConditions: longStr,
  latestSummaryText: longStr,
  pharmacy: z
    .object({
      name: shortStr,
      phone: phoneStr,
      address: longStr,
    })
    .optional(),
  advanceDirective: z
    .object({
      hasDirective: z.boolean().optional(),
      type: directiveType,
      notes: longStr,
      fileKey: shortStr,
    })
    .optional(),
  insuranceCard: z
    .object({
      payer: shortStr,
      memberId: shortStr,
      groupNumber: shortStr,
      frontFileKey: shortStr,
      backFileKey: shortStr,
    })
    .optional(),
  // When true, stamp consentEmergencySharingAt = now; when false, clear it.
  consentEmergencySharing: z.boolean().optional(),
});

type EmergencyInput = z.infer<typeof emergencySchema>;

const tokenSchema = z.object({
  label: shortStr,
  expiresInHours: z.number().int().min(1).max(720).optional(),
  pin: z
    .string()
    .trim()
    .max(32)
    .regex(/^[0-9]{4,8}$/, "PIN must be 4-8 digits")
    .optional()
    .or(z.literal("")),
});

// ---- Encrypt / decrypt helpers -------------------------------------------

// Encrypt a value only when present; tolerate already-encrypted input.
function enc(value: unknown): string {
  if (typeof value !== "string" || value === "") return "";
  return isEncrypted(value) ? value : encryptPhi(value);
}

// Decrypt a value only when present; tolerate legacy plaintext.
function dec(value: unknown): string {
  if (typeof value !== "string" || value === "") return "";
  return isEncrypted(value) ? decryptPhi(value) : value;
}

function asBool(value: unknown): boolean {
  return value === true;
}

function asStr(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// Empty client-facing shape (always fully populated).
function emptyEmergency() {
  return {
    bloodType: "",
    allergiesSummary: "",
    criticalConditions: "",
    latestSummaryText: "",
    pharmacy: { name: "", phone: "", address: "" },
    advanceDirective: {
      hasDirective: false,
      type: "",
      notes: "",
      fileKey: "",
    },
    insuranceCard: {
      payer: "",
      memberId: "",
      groupNumber: "",
      frontFileKey: "",
      backFileKey: "",
    },
    consentEmergencySharingAt: null as string | null,
  };
}

// Merge validated input into the EXISTING stored (encrypted) emergency object,
// encrypting PHI string fields. Unspecified nested fields are preserved.
function mergeEncryptedEmergency(input: EmergencyInput, existingRaw: unknown) {
  const existing = (existingRaw && typeof existingRaw === "object"
    ? existingRaw
    : {}) as Record<string, any>;
  const exPharm = (existing.pharmacy ?? {}) as Record<string, any>;
  const exDir = (existing.advanceDirective ?? {}) as Record<string, any>;
  const exIns = (existing.insuranceCard ?? {}) as Record<string, any>;

  const pickEnc = (next: unknown, prev: unknown) =>
    next === undefined ? asStr(prev) : enc(next as string);

  // Consent: explicit true stamps now (preserving an earlier stamp if present);
  // explicit false clears; undefined leaves untouched.
  let consentAt: string | null =
    typeof existing.consentEmergencySharingAt === "string"
      ? existing.consentEmergencySharingAt
      : null;
  if (input.consentEmergencySharing === true) {
    consentAt = consentAt ?? new Date().toISOString();
  } else if (input.consentEmergencySharing === false) {
    consentAt = null;
  }

  return {
    bloodType: pickEnc(input.bloodType, existing.bloodType),
    allergiesSummary: pickEnc(input.allergiesSummary, existing.allergiesSummary),
    criticalConditions: pickEnc(
      input.criticalConditions,
      existing.criticalConditions,
    ),
    latestSummaryText: pickEnc(
      input.latestSummaryText,
      existing.latestSummaryText,
    ),
    pharmacy: {
      name: pickEnc(input.pharmacy?.name, exPharm.name),
      phone: pickEnc(input.pharmacy?.phone, exPharm.phone),
      address: pickEnc(input.pharmacy?.address, exPharm.address),
    },
    advanceDirective: {
      hasDirective:
        input.advanceDirective?.hasDirective === undefined
          ? asBool(exDir.hasDirective)
          : asBool(input.advanceDirective.hasDirective),
      // type + fileKey stay plaintext.
      type:
        input.advanceDirective?.type === undefined
          ? asStr(exDir.type)
          : asStr(input.advanceDirective.type),
      notes: pickEnc(input.advanceDirective?.notes, exDir.notes),
      fileKey:
        input.advanceDirective?.fileKey === undefined
          ? asStr(exDir.fileKey)
          : asStr(input.advanceDirective.fileKey),
    },
    insuranceCard: {
      payer: pickEnc(input.insuranceCard?.payer, exIns.payer),
      memberId: pickEnc(input.insuranceCard?.memberId, exIns.memberId),
      groupNumber: pickEnc(input.insuranceCard?.groupNumber, exIns.groupNumber),
      // fileKeys stay plaintext.
      frontFileKey:
        input.insuranceCard?.frontFileKey === undefined
          ? asStr(exIns.frontFileKey)
          : asStr(input.insuranceCard.frontFileKey),
      backFileKey:
        input.insuranceCard?.backFileKey === undefined
          ? asStr(exIns.backFileKey)
          : asStr(input.insuranceCard.backFileKey),
    },
    consentEmergencySharingAt: consentAt,
  };
}

// Decrypt stored emergency back to plaintext for the owning patient.
function decryptEmergency(storedRaw: unknown) {
  const base = emptyEmergency();
  if (!storedRaw || typeof storedRaw !== "object") return base;
  const stored = storedRaw as Record<string, any>;
  const pharm = (stored.pharmacy ?? {}) as Record<string, any>;
  const dir = (stored.advanceDirective ?? {}) as Record<string, any>;
  const ins = (stored.insuranceCard ?? {}) as Record<string, any>;
  return {
    bloodType: dec(stored.bloodType),
    allergiesSummary: dec(stored.allergiesSummary),
    criticalConditions: dec(stored.criticalConditions),
    latestSummaryText: dec(stored.latestSummaryText),
    pharmacy: {
      name: dec(pharm.name),
      phone: dec(pharm.phone),
      address: dec(pharm.address),
    },
    advanceDirective: {
      hasDirective: asBool(dir.hasDirective),
      type: asStr(dir.type),
      notes: dec(dir.notes),
      fileKey: asStr(dir.fileKey),
    },
    insuranceCard: {
      payer: dec(ins.payer),
      memberId: dec(ins.memberId),
      groupNumber: dec(ins.groupNumber),
      frontFileKey: asStr(ins.frontFileKey),
      backFileKey: asStr(ins.backFileKey),
    },
    consentEmergencySharingAt:
      typeof stored.consentEmergencySharingAt === "string"
        ? stored.consentEmergencySharingAt
        : null,
  };
}

// Decrypt just the patient-contacts nextOfKin/pcp the redeem view needs.
function decryptContactBlock(contactsRaw: unknown) {
  const c = (contactsRaw && typeof contactsRaw === "object"
    ? contactsRaw
    : {}) as Record<string, any>;
  const nok = (c.nextOfKin ?? {}) as Record<string, any>;
  const pcp = (c.pcp ?? {}) as Record<string, any>;
  return {
    nextOfKin: {
      name: dec(nok.name),
      relationship: asStr(nok.relationship),
      phone: dec(nok.phone),
      email: dec(nok.email),
    },
    pcp: {
      name: dec(pcp.name),
      phone: dec(pcp.phone),
    },
  };
}

// ---- Token hashing (Node crypto, no new deps) -----------------------------

// A URL-safe secret of >=32 bytes (64 hex chars; contains no "_").
function makeSecret(): string {
  return randomBytes(32).toString("hex");
}

// sha256 over `${salt}:${secret}` with a fresh per-value salt. Stored as
// `${salt}:${hash}`. Never store the raw secret/pin.
function hashWithSalt(value: string, salt?: string): string {
  const s = salt ?? randomBytes(16).toString("hex");
  const h = createHash("sha256").update(`${s}:${value}`).digest("hex");
  return `${s}:${h}`;
}

// Constant-time verification against a stored `${salt}:${hash}` string.
function verifyHash(value: string, stored: string | null | undefined): boolean {
  if (!stored || typeof stored !== "string") return false;
  const idx = stored.indexOf(":");
  if (idx < 0) return false;
  const salt = stored.slice(0, idx);
  const computed = hashWithSalt(value, salt);
  const a = Buffer.from(stored);
  const b = Buffer.from(computed);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Token format: `emrg_<profileId>_<secret>`. profileId (uuid) and the hex
// secret both contain no "_", so we split on the first "_" after the prefix.
function buildToken(profileId: string, secret: string): string {
  return `emrg_${profileId}_${secret}`;
}

function parseToken(
  token: string | undefined | null,
): { profileId: string; secret: string } | null {
  if (!token || typeof token !== "string" || !token.startsWith("emrg_")) {
    return null;
  }
  const rest = token.slice("emrg_".length);
  const idx = rest.indexOf("_");
  if (idx <= 0) return null;
  const profileId = rest.slice(0, idx);
  const secret = rest.slice(idx + 1);
  if (!profileId || !secret) return null;
  return { profileId, secret };
}

// ---- Misc helpers ---------------------------------------------------------

// Extract a client IP suitable for the `inet` audit column, or null.
function clientIp(req: Request): string | null {
  const xf = req.headers["x-forwarded-for"];
  const fwd = Array.isArray(xf) ? xf[0] : xf;
  const raw =
    (fwd ? fwd.split(",")[0].trim() : "") ||
    req.ip ||
    req.socket?.remoteAddress ||
    "";
  const candidate = raw.replace(/^::ffff:/, "");
  const isV4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(candidate);
  const isV6 = candidate.includes(":") && /^[0-9a-fA-F:]+$/.test(candidate);
  return isV4 || isV6 ? raw : null;
}

async function signFileKey(fileKey: unknown): Promise<string | null> {
  if (typeof fileKey !== "string" || !fileKey) return null;
  try {
    return await objectStorage.getSignedDownloadURL(fileKey, 600);
  } catch (err: any) {
    console.error("[Emergency] Failed to sign file URL:", err?.message);
    return null;
  }
}

// ---- Ownership ------------------------------------------------------------

type OwnedProfile = {
  id: string;
  accountId: string;
  fullName: string;
  dob: string;
  metadata: Record<string, unknown> | null;
};

type OwnershipResult =
  | { ok: false; status: number; body: Record<string, unknown> }
  | { ok: true; profile: OwnedProfile };

// Loads the profile and verifies it belongs to the authenticated account.
async function loadOwnedProfile(
  req: AuthRequest,
  profileId: string,
): Promise<OwnershipResult> {
  if (!req.user?.claims?.sub) {
    return { ok: false, status: 401, body: { error: "AUTH_REQUIRED" } };
  }

  const accountId = await resolveAccountId(req);
  if (!accountId) {
    return { ok: false, status: 403, body: { error: "ACCOUNT_NOT_PROVISIONED" } };
  }

  const [profile] = await db
    .select({
      id: profiles.id,
      accountId: profiles.accountId,
      fullName: profiles.fullName,
      dob: profiles.dob,
      metadata: profiles.metadata,
    })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);

  if (!profile) {
    return { ok: false, status: 404, body: { error: "PROFILE_NOT_FOUND" } };
  }

  // OWNERSHIP CHECK: the profile's accountId must match the caller's account.
  if (profile.accountId !== accountId) {
    return {
      ok: false,
      status: 403,
      body: {
        error: "FORBIDDEN",
        message: "You do not have access to this profile.",
      },
    };
  }

  return { ok: true, profile: profile as OwnedProfile };
}

// Build the client-facing list of ACTIVE tokens (never the secret).
function activeTokenList(tokensRaw: unknown) {
  const now = Date.now();
  const tokens = Array.isArray(tokensRaw) ? tokensRaw : [];
  return tokens
    .filter(
      (t: any) =>
        t &&
        !t.revoked &&
        typeof t.expiresAt === "string" &&
        new Date(t.expiresAt).getTime() > now,
    )
    .map((t: any) => ({
      id: t.id,
      label: typeof t.label === "string" ? t.label : "",
      expiresAt: t.expiresAt,
      hasPin: !!t.pinHash,
      createdAt: typeof t.createdAt === "string" ? t.createdAt : null,
    }));
}

// ---- Authenticated routes (mounted at /api/patient-contacts) --------------

// 1) GET /:profileId/emergency — decrypted emergency info + active tokens.
router.get(
  "/:profileId/emergency",
  isAuthenticated,
  async (req: AuthRequest, res: Response) => {
    try {
      const { profileId } = req.params;
      const result = await loadOwnedProfile(req, profileId);
      if (!result.ok) {
        return res.status(result.status).json(result.body);
      }

      const metadata = (result.profile.metadata ?? {}) as Record<string, unknown>;
      const emergency = decryptEmergency(metadata.emergency);
      const tokens = activeTokenList(metadata.emergencyTokens);

      res.json({ emergency, tokens });
    } catch (error: any) {
      console.error("[Emergency] GET failed:", error?.message);
      res.status(500).json({ error: "Failed to load emergency info" });
    }
  },
);

// 2) PUT /:profileId/emergency — validate, encrypt, merge, save.
router.put(
  "/:profileId/emergency",
  isAuthenticated,
  async (req: AuthRequest, res: Response) => {
    try {
      const { profileId } = req.params;

      const validation = emergencySchema.safeParse(req.body);
      if (!validation.success) {
        return res
          .status(400)
          .json({ error: "Invalid request", details: validation.error.issues });
      }

      const result = await loadOwnedProfile(req, profileId);
      if (!result.ok) {
        return res.status(result.status).json(result.body);
      }

      const existingMetadata = (result.profile.metadata ?? {}) as Record<
        string,
        unknown
      >;
      const encryptedEmergency = mergeEncryptedEmergency(
        validation.data,
        existingMetadata.emergency,
      );

      // MERGE: preserve every other metadata key (incl. contacts + tokens).
      const nextMetadata: Record<string, unknown> = {
        ...existingMetadata,
        emergency: encryptedEmergency,
      };

      await db
        .update(profiles)
        .set({ metadata: nextMetadata, updatedAt: new Date() })
        .where(eq(profiles.id, profileId));

      console.log(`[Emergency] Updated emergency info for profile ${profileId}`);

      res.json({ ok: true, emergency: decryptEmergency(encryptedEmergency) });
    } catch (error: any) {
      console.error("[Emergency] PUT failed:", error?.message);
      res.status(500).json({ error: "Failed to save emergency info" });
    }
  },
);

// 6) POST /:profileId/emergency/upload-url — presigned PUT for card/doc uploads.
router.post(
  "/:profileId/emergency/upload-url",
  isAuthenticated,
  async (req: AuthRequest, res: Response) => {
    try {
      const { profileId } = req.params;
      const result = await loadOwnedProfile(req, profileId);
      if (!result.ok) {
        return res.status(result.status).json(result.body);
      }

      const uploadURL = await objectStorage.getObjectEntityUploadURL();
      const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);

      res.json({ uploadURL, objectPath });
    } catch (error: any) {
      console.error("[Emergency] upload-url failed:", error?.message);
      res.status(500).json({ error: "Failed to create upload URL" });
    }
  },
);

// 3) POST /:profileId/emergency-token — create a break-glass share token.
router.post(
  "/:profileId/emergency-token",
  isAuthenticated,
  async (req: AuthRequest, res: Response) => {
    try {
      const { profileId } = req.params;

      const validation = tokenSchema.safeParse(req.body ?? {});
      if (!validation.success) {
        return res
          .status(400)
          .json({ error: "Invalid request", details: validation.error.issues });
      }

      const result = await loadOwnedProfile(req, profileId);
      if (!result.ok) {
        return res.status(result.status).json(result.body);
      }

      const existingMetadata = (result.profile.metadata ?? {}) as Record<
        string,
        unknown
      >;
      const emergency = (existingMetadata.emergency ?? {}) as Record<
        string,
        unknown
      >;

      // CONSENT GATE: a share cannot be created until the patient has
      // affirmatively consented to emergency sharing.
      if (typeof emergency.consentEmergencySharingAt !== "string") {
        return res.status(409).json({
          error: "CONSENT_REQUIRED",
          message:
            "Enable emergency-sharing consent before generating a share.",
        });
      }

      const { label, expiresInHours, pin } = validation.data;
      const hours = expiresInHours ?? 72;
      const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();

      const id = randomUUID();
      const secret = makeSecret();
      const pinValue = typeof pin === "string" && pin !== "" ? pin : null;

      const tokenRecord = {
        id,
        secretHash: hashWithSalt(secret),
        pinHash: pinValue ? hashWithSalt(pinValue) : null,
        expiresAt,
        revoked: false,
        createdAt: new Date().toISOString(),
        label: typeof label === "string" ? label : "",
      };

      const existingTokens = Array.isArray(existingMetadata.emergencyTokens)
        ? (existingMetadata.emergencyTokens as any[])
        : [];

      const nextMetadata: Record<string, unknown> = {
        ...existingMetadata,
        emergencyTokens: [...existingTokens, tokenRecord],
      };

      await db
        .update(profiles)
        .set({ metadata: nextMetadata, updatedAt: new Date() })
        .where(eq(profiles.id, profileId));

      const fullToken = buildToken(profileId, secret);

      console.log(`[Emergency] Created share token ${id} for profile ${profileId}`);

      // The full token + secret are returned EXACTLY ONCE here.
      res.json({
        id,
        token: fullToken,
        shareUrl: `/emergency/${fullToken}`,
        expiresAt,
        hasPin: !!pinValue,
        label: tokenRecord.label,
      });
    } catch (error: any) {
      console.error("[Emergency] token create failed:", error?.message);
      res.status(500).json({ error: "Failed to create share token" });
    }
  },
);

// 4) POST /:profileId/emergency-token/:tokenId/revoke — revoke a token.
router.post(
  "/:profileId/emergency-token/:tokenId/revoke",
  isAuthenticated,
  async (req: AuthRequest, res: Response) => {
    try {
      const { profileId, tokenId } = req.params;
      const result = await loadOwnedProfile(req, profileId);
      if (!result.ok) {
        return res.status(result.status).json(result.body);
      }

      const existingMetadata = (result.profile.metadata ?? {}) as Record<
        string,
        unknown
      >;
      const existingTokens = Array.isArray(existingMetadata.emergencyTokens)
        ? (existingMetadata.emergencyTokens as any[])
        : [];

      let found = false;
      const nextTokens = existingTokens.map((t: any) => {
        if (t && t.id === tokenId) {
          found = true;
          return { ...t, revoked: true };
        }
        return t;
      });

      if (!found) {
        return res.status(404).json({ error: "TOKEN_NOT_FOUND" });
      }

      const nextMetadata: Record<string, unknown> = {
        ...existingMetadata,
        emergencyTokens: nextTokens,
      };

      await db
        .update(profiles)
        .set({ metadata: nextMetadata, updatedAt: new Date() })
        .where(eq(profiles.id, profileId));

      console.log(`[Emergency] Revoked share token ${tokenId} for profile ${profileId}`);

      res.json({ ok: true });
    } catch (error: any) {
      console.error("[Emergency] token revoke failed:", error?.message);
      res.status(500).json({ error: "Failed to revoke share token" });
    }
  },
);

// ---- Public route (mounted at /api/emergency — NO auth) -------------------

// 5) GET /api/emergency/redeem?token=...&pin=... — break-glass view.
publicRouter.get("/redeem", async (req: Request, res: Response) => {
  // Generic failure: never leak which part (token/pin/expiry) failed.
  const fail = () => res.status(404).json({ error: "NOT_FOUND" });

  try {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    const pin = typeof req.query.pin === "string" ? req.query.pin : "";

    const parsed = parseToken(token);
    if (!parsed) return fail();

    const { profileId, secret } = parsed;

    // profileId must be a uuid for the WHERE clause not to throw.
    if (
      !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        profileId,
      )
    ) {
      return fail();
    }

    const [profile] = await db
      .select({
        id: profiles.id,
        fullName: profiles.fullName,
        dob: profiles.dob,
        metadata: profiles.metadata,
      })
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .limit(1);

    if (!profile) return fail();

    const metadata = (profile.metadata ?? {}) as Record<string, unknown>;
    const tokens = Array.isArray(metadata.emergencyTokens)
      ? (metadata.emergencyTokens as any[])
      : [];

    const now = Date.now();
    const match = tokens.find(
      (t: any) =>
        t &&
        !t.revoked &&
        typeof t.expiresAt === "string" &&
        new Date(t.expiresAt).getTime() > now &&
        verifyHash(secret, t.secretHash),
    );

    if (!match) return fail();

    // PIN gate (only enforced when the token was created with a PIN).
    if (match.pinHash) {
      if (!pin || !verifyHash(pin, match.pinHash)) {
        return res.status(401).json({ error: "PIN_REQUIRED" });
      }
    }

    // AUDIT: write a row for every successful break-glass access.
    try {
      await db.insert(auditLogTable).values({
        action: "emergency_access",
        profileId: profile.id,
        targetType: "emergency",
        ipAddress: clientIp(req),
        userAgent:
          typeof req.headers["user-agent"] === "string"
            ? req.headers["user-agent"]
            : null,
        appSource: "tabula-medica",
      });
    } catch (auditErr: any) {
      console.error("[Emergency] audit write failed:", auditErr?.message);
    }

    // Build the MINIMAL-NECESSARY decrypted view.
    const emergency = decryptEmergency(metadata.emergency);
    const contacts = decryptContactBlock(metadata.contacts);

    const [advanceDirectiveUrl, insuranceFrontUrl, insuranceBackUrl] =
      await Promise.all([
        signFileKey(emergency.advanceDirective.fileKey),
        signFileKey(emergency.insuranceCard.frontFileKey),
        signFileKey(emergency.insuranceCard.backFileKey),
      ]);

    res.json({
      patient: {
        name: profile.fullName,
        dob: profile.dob,
      },
      bloodType: emergency.bloodType,
      allergiesSummary: emergency.allergiesSummary,
      criticalConditions: emergency.criticalConditions,
      latestSummaryText: emergency.latestSummaryText,
      emergencyContact: contacts.nextOfKin,
      pcp: contacts.pcp,
      pharmacy: emergency.pharmacy,
      advanceDirective: {
        hasDirective: emergency.advanceDirective.hasDirective,
        type: emergency.advanceDirective.type,
        notes: emergency.advanceDirective.notes,
        fileUrl: advanceDirectiveUrl,
      },
      insuranceCard: {
        payer: emergency.insuranceCard.payer,
        memberId: emergency.insuranceCard.memberId,
        groupNumber: emergency.insuranceCard.groupNumber,
        frontUrl: insuranceFrontUrl,
        backUrl: insuranceBackUrl,
      },
      accessedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Emergency] redeem failed:", error?.message);
    return fail();
  }
});

console.log("[Emergency] Emergency Info & Break-Glass routes initialized");

export default router;
