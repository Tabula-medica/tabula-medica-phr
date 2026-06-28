import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { profiles } from "@shared/schema";
import { isAuthenticated } from "../replit_integrations/auth";
import { resolveAccountId } from "../middleware/require-phi-access";
import { encryptPhi, decryptPhi, isEncrypted } from "../security/phi-encryption";

const router = Router();

/**
 * Emergency Contact & Care Team
 *
 * Stores OPTIONAL, patient-chosen contact information inside the existing
 * `profiles.metadata` jsonb column under `metadata.contacts`. NO migration.
 *
 * PHI values are encrypted at rest with AES-256-GCM via encryptPhi/decryptPhi.
 * The only plaintext field is nextOfKin.relationship (not sensitive).
 *
 * Every route is gated by `isAuthenticated` and verifies that the target
 * profile's accountId belongs to the authenticated account before any
 * read/write. Decrypted PHI is never logged.
 */

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

const optionalStr = z
  .string()
  .trim()
  .max(MAX_LEN, `Must be ${MAX_LEN} characters or fewer`)
  .optional()
  .or(z.literal(""));

const optionalEmail = z
  .string()
  .trim()
  .max(MAX_LEN)
  .email("Invalid email address")
  .optional()
  .or(z.literal(""));

// Lenient phone sanity check: digits, spaces, and common phone punctuation.
const optionalPhone = z
  .string()
  .trim()
  .max(MAX_LEN)
  .regex(/^[0-9+()\-.\s]{3,}$/, "Invalid phone number")
  .optional()
  .or(z.literal(""));

const contactsSchema = z.object({
  nextOfKin: z
    .object({
      name: optionalStr,
      relationship: optionalStr,
      phone: optionalPhone,
      email: optionalEmail,
    })
    .optional(),
  pcp: z
    .object({
      name: optionalStr,
      phone: optionalPhone,
    })
    .optional(),
  patient: z
    .object({
      phone: optionalPhone,
      email: optionalEmail,
    })
    .optional(),
});

type ContactsInput = z.infer<typeof contactsSchema>;

// Shape returned to the client (always populated with empty-string defaults).
function emptyContacts() {
  return {
    nextOfKin: { name: "", relationship: "", phone: "", email: "" },
    pcp: { name: "", phone: "" },
    patient: { phone: "", email: "" },
  };
}

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

// Encrypt the sensitive fields for at-rest storage. relationship stays plaintext.
function encryptContacts(input: ContactsInput) {
  return {
    nextOfKin: {
      name: enc(input.nextOfKin?.name),
      relationship:
        typeof input.nextOfKin?.relationship === "string"
          ? input.nextOfKin.relationship
          : "",
      phone: enc(input.nextOfKin?.phone),
      email: enc(input.nextOfKin?.email),
    },
    pcp: {
      name: enc(input.pcp?.name),
      phone: enc(input.pcp?.phone),
    },
    patient: {
      phone: enc(input.patient?.phone),
      email: enc(input.patient?.email),
    },
  };
}

// Decrypt stored contacts back to plaintext for the owning patient.
function decryptContacts(stored: any) {
  const base = emptyContacts();
  if (!stored || typeof stored !== "object") return base;
  return {
    nextOfKin: {
      name: dec(stored.nextOfKin?.name),
      relationship:
        typeof stored.nextOfKin?.relationship === "string"
          ? stored.nextOfKin.relationship
          : "",
      phone: dec(stored.nextOfKin?.phone),
      email: dec(stored.nextOfKin?.email),
    },
    pcp: {
      name: dec(stored.pcp?.name),
      phone: dec(stored.pcp?.phone),
    },
    patient: {
      phone: dec(stored.patient?.phone),
      email: dec(stored.patient?.email),
    },
  };
}

// ---- Ownership ------------------------------------------------------------

// Loads the profile and verifies it belongs to the authenticated account.
// Returns { status, body } on failure, or { profile } on success.
async function loadOwnedProfile(req: AuthRequest, profileId: string) {
  if (!req.user?.claims?.sub) {
    return { error: { status: 401, body: { error: "AUTH_REQUIRED" } } };
  }

  const accountId = await resolveAccountId(req);
  if (!accountId) {
    return {
      error: { status: 403, body: { error: "ACCOUNT_NOT_PROVISIONED" } },
    };
  }

  const [profile] = await db
    .select({ id: profiles.id, accountId: profiles.accountId, metadata: profiles.metadata })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);

  if (!profile) {
    return { error: { status: 404, body: { error: "PROFILE_NOT_FOUND" } } };
  }

  // OWNERSHIP CHECK: the profile's accountId must match the caller's account.
  if (profile.accountId !== accountId) {
    return {
      error: {
        status: 403,
        body: { error: "FORBIDDEN", message: "You do not have access to this profile." },
      },
    };
  }

  return { profile };
}

// ---- Routes ---------------------------------------------------------------

// GET /:profileId — return DECRYPTED contacts (or empty defaults).
router.get("/:profileId", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const { profileId } = req.params;
    const result = await loadOwnedProfile(req, profileId);
    if ("error" in result) {
      return res.status(result.error.status).json(result.error.body);
    }

    const metadata = (result.profile.metadata ?? {}) as Record<string, unknown>;
    const contacts = decryptContacts(metadata.contacts);

    res.json({ contacts });
  } catch (error: any) {
    console.error("[PatientContacts] GET failed:", error?.message);
    res.status(500).json({ error: "Failed to load contacts" });
  }
});

// PUT /:profileId — validate, ENCRYPT, MERGE into metadata.contacts, save.
router.put("/:profileId", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const { profileId } = req.params;

    const validation = contactsSchema.safeParse(req.body);
    if (!validation.success) {
      return res
        .status(400)
        .json({ error: "Invalid request", details: validation.error.issues });
    }

    const result = await loadOwnedProfile(req, profileId);
    if ("error" in result) {
      return res.status(result.error.status).json(result.error.body);
    }

    const existingMetadata = (result.profile.metadata ?? {}) as Record<string, unknown>;
    const encryptedContacts = encryptContacts(validation.data);

    // MERGE: preserve every other metadata key, only replace `contacts`.
    const nextMetadata: Record<string, unknown> = {
      ...existingMetadata,
      contacts: encryptedContacts,
    };

    await db
      .update(profiles)
      .set({ metadata: nextMetadata, updatedAt: new Date() })
      .where(eq(profiles.id, profileId));

    // Never log decrypted values — only confirm the write succeeded.
    console.log(`[PatientContacts] Updated contacts for profile ${profileId}`);

    res.json({ ok: true, contacts: decryptContacts(encryptedContacts) });
  } catch (error: any) {
    console.error("[PatientContacts] PUT failed:", error?.message);
    res.status(500).json({ error: "Failed to save contacts" });
  }
});

console.log("[PatientContacts] Emergency Contact & Care Team routes initialized");

export default router;
