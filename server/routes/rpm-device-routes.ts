/**
 * RPM (remote patient monitoring) clinical device enrollment + ingestion.
 *
 * VitalFriend (vitalfriend.com) is an FDA-cleared RPM platform for senior
 * care whose devices ("Vital Buddy", "BUDDI") report blood pressure,
 * heart rate, blood oxygen, and temperature — a subset of our clinical
 * vitalSignTypes. VitalFriend doesn't publish a self-serve developer API;
 * integration credentials (webhook URL registration, auth mechanism,
 * exact payload shape) are issued directly to enrolled care
 * organizations by VitalFriend's team.
 *
 * This router is built against a reasonable, clearly-labeled ASSUMED
 * payload/auth shape (a shared-secret header + a flat readings array) so
 * the rest of the pipeline — device enrollment, threshold checking,
 * alerting — is real and ready today. Before going live:
 *   1. Get VitalFriend's actual webhook payload spec and auth mechanism
 *      from your VitalFriend integration contact.
 *   2. Update `vitalFriendPayloadSchema` below to match it exactly,
 *      including how VitalFriend actually proves a device is what it
 *      claims to be (see the pairing/activation note below).
 *   3. If VitalFriend signs webhooks (HMAC) rather than using a static
 *      shared secret, replace the header check with real signature
 *      verification, mirroring verifyTerraWebhookSignature in
 *      terra-integration-service.ts.
 * Nothing here silently invents data: an unrecognized payload shape is
 * rejected with a 422 and logged (without the PHI-bearing payload body),
 * not guessed at.
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { db } from "../db";
import { rpmDevicesTable, rpmMonitoringDeviceTypes, rpmDeviceProviders, type VitalSignType } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { ingestVitalReading } from "../services/vital-thresholds";
import { isAuthenticated } from "../replit_integrations/auth";
import { requireProfile } from "../services/resolve-profile";
import { withDeliveryClaim } from "../services/webhook-idempotency";
import { noStorePhi } from "../lib/middleware/no-store-phi";

const router = Router();

function hashIdentifier(id: string): string {
  return id.slice(0, 8) + "***";
}

function logHipaaAudit(action: string, profileId: string | null, resourceId: string, details: string) {
  console.log(
    `[HIPAA-AUDIT][RPM-Devices] ${new Date().toISOString()} - ${action} - Profile:${profileId ? hashIdentifier(profileId) : "NONE"} - Resource:${resourceId} - ${details}`,
  );
}

// Common vendor field-name variants for our clinical vital types, so a
// device/provider payload doesn't have to match our internal naming
// exactly. Extend this as you onboard providers.
const VITAL_TYPE_ALIASES: Record<string, VitalSignType> = {
  blood_pressure_systolic: "blood_pressure_systolic",
  bp_systolic: "blood_pressure_systolic",
  systolic: "blood_pressure_systolic",
  blood_pressure_diastolic: "blood_pressure_diastolic",
  bp_diastolic: "blood_pressure_diastolic",
  diastolic: "blood_pressure_diastolic",
  heart_rate: "heart_rate",
  hr: "heart_rate",
  pulse: "heart_rate",
  blood_glucose: "blood_glucose",
  glucose: "blood_glucose",
  weight: "weight",
  temperature: "temperature",
  temp: "temperature",
  oxygen_saturation: "oxygen_saturation",
  spo2: "oxygen_saturation",
  respiratory_rate: "respiratory_rate",
  resp_rate: "respiratory_rate",
};

export function resolveVitalType(raw: string): VitalSignType | null {
  const normalized = raw?.toLowerCase?.().trim();
  if (!normalized) return null;
  return VITAL_TYPE_ALIASES[normalized] ?? null;
}

// Each clinical vital type has one canonical internal unit (see
// vital-thresholds.ts) and a small set of unit strings a device might
// plausibly send, each with a converter to the canonical unit. A unit
// that isn't in this table is rejected rather than silently trusted —
// mistaking °C for °F, or kg for lbs, would store and threshold-check a
// wildly wrong value.
const UNIT_CONVERTERS: Record<VitalSignType, { canonical: string; accepted: Record<string, (v: number) => number> }> = {
  heart_rate: { canonical: "bpm", accepted: { bpm: (v) => v } },
  blood_pressure_systolic: { canonical: "mmHg", accepted: { mmhg: (v) => v } },
  blood_pressure_diastolic: { canonical: "mmHg", accepted: { mmhg: (v) => v } },
  blood_glucose: {
    canonical: "mg/dL",
    accepted: { "mg/dl": (v) => v, "mmol/l": (v) => Math.round(v * 18.0182 * 10) / 10 },
  },
  weight: { canonical: "lbs", accepted: { lbs: (v) => v, lb: (v) => v, kg: (v) => Math.round(v * 2.20462 * 10) / 10 } },
  temperature: {
    canonical: "°F",
    accepted: {
      "°f": (v) => v,
      f: (v) => v,
      "°c": (v) => Math.round((v * 9) / 5 + 32),
      c: (v) => Math.round((v * 9) / 5 + 32),
    },
  },
  oxygen_saturation: { canonical: "%", accepted: { "%": (v) => v, percent: (v) => v } },
  respiratory_rate: { canonical: "breaths/min", accepted: { "breaths/min": (v) => v } },
};

export function normalizeUnit(vitalType: VitalSignType, value: number, unit: string): { value: number; unit: string } | null {
  const config = UNIT_CONVERTERS[vitalType];
  const key = unit.trim().toLowerCase();
  const convert = config.accepted[key];
  if (!convert) return null;
  return { value: convert(value), unit: config.canonical };
}

// --- Device enrollment (patient/caregiver self-service pairing) ---------

router.use(isAuthenticated, requireProfile, noStorePhi);

router.get("/devices", async (req: Request, res: Response) => {
  const profileId = (req as any).resolvedProfileId as string;
  const devices = await db
    .select()
    .from(rpmDevicesTable)
    .where(eq(rpmDevicesTable.profileId, profileId))
    .orderBy(desc(rpmDevicesTable.createdAt));

  logHipaaAudit("DEVICES_READ", profileId, "rpm_devices", `Retrieved ${devices.length} devices`);

  res.json({ success: true, devices });
});

const enrollDeviceSchema = z.object({
  provider: z.enum(rpmDeviceProviders).default("vitalfriend"),
  deviceType: z.enum(rpmMonitoringDeviceTypes),
  externalDeviceId: z.string().min(1),
  // Required, not optional: enrollment is single-factor (whoever types in
  // a device's printed ID can claim it and receive its readings/PHI)
  // unless we also require the serial number printed alongside it. The
  // device only flips from "pending" to "active" once its first inbound
  // reading confirms the same serial number — see the webhook handler.
  // This is a meaningful mitigation, not vendor-verified ownership; treat
  // it as provisional until VitalFriend's real pairing/claim flow is
  // integrated.
  serialNumber: z.string().min(1),
});

router.post("/devices", async (req: Request, res: Response) => {
  try {
    const profileId = (req as any).resolvedProfileId as string;
    const data = enrollDeviceSchema.parse(req.body);

    const [existing] = await db
      .select()
      .from(rpmDevicesTable)
      .where(and(eq(rpmDevicesTable.provider, data.provider), eq(rpmDevicesTable.externalDeviceId, data.externalDeviceId)));

    if (existing) {
      return res.status(409).json({ success: false, error: "This device is already enrolled" });
    }

    const [device] = await db
      .insert(rpmDevicesTable)
      .values({
        profileId,
        provider: data.provider,
        deviceType: data.deviceType,
        externalDeviceId: data.externalDeviceId,
        serialNumber: data.serialNumber,
        // Not "active" yet — see the webhook handler's activation check.
        status: "pending",
      })
      .returning();

    logHipaaAudit("DEVICE_ENROLLED", profileId, device.id, `provider=${data.provider} type=${data.deviceType} status=pending`);

    res.status(201).json({ success: true, device });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Invalid device data", details: error.errors });
    }
    console.error("[RPM Devices] Enroll error:", error);
    res.status(500).json({ success: false, error: "Failed to enroll device" });
  }
});

router.delete("/devices/:id", async (req: Request, res: Response) => {
  try {
    const profileId = (req as any).resolvedProfileId as string;
    const { id } = req.params;

    const [device] = await db.select().from(rpmDevicesTable).where(eq(rpmDevicesTable.id, id));
    if (!device || device.profileId !== profileId) {
      return res.status(404).json({ success: false, error: "Device not found" });
    }

    await db
      .update(rpmDevicesTable)
      .set({ status: "inactive", deactivatedAt: new Date() })
      .where(eq(rpmDevicesTable.id, id));

    logHipaaAudit("DEVICE_DEACTIVATED", profileId, id, `provider=${device.provider}`);

    res.json({ success: true, message: "Device removed" });
  } catch (error) {
    console.error("[RPM Devices] Remove error:", error);
    res.status(500).json({ success: false, error: "Failed to remove device" });
  }
});

// --- Inbound readings webhook (VitalFriend, ASSUMED shape) --------------

// ASSUMED payload shape, pending VitalFriend's actual integration spec:
//   {
//     "device_id": "<externalDeviceId, matches an enrolled rpm_devices row>",
//     "serial_number": "<the same serial number entered at enrollment>",
//     "readings": [
//       { "vital_type": "blood_pressure_systolic", "value": 132, "unit": "mmHg", "recorded_at": "2026-09-20T14:00:00Z" },
//       ...
//     ]
//   }
// `serial_number` is used only to gate activation of a pending device
// (see below) — a real vendor spec may prove device identity differently
// (a signed payload, a vendor-issued pairing token, ...), so revisit this
// once you have it.
const isoDateString = z.string().refine((v) => !Number.isNaN(Date.parse(v)), { message: "Invalid date" });
const vitalFriendReadingSchema = z.object({
  vital_type: z.string(),
  value: z.number(),
  unit: z.string().min(1),
  recorded_at: isoDateString.optional(),
});
const vitalFriendPayloadSchema = z.object({
  device_id: z.string(),
  serial_number: z.string().optional(),
  readings: z.array(vitalFriendReadingSchema).min(1),
});

function verifySharedSecret(providedSecret: string | undefined): boolean {
  const expected = process.env.VITALFRIEND_WEBHOOK_SECRET || "";
  if (!expected || !providedSecret) return false;

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(providedSecret);
  if (expectedBuf.length !== providedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

// Mounted without isAuthenticated further down (VitalFriend calls this
// server-to-server, with no patient session) — see route registration in
// server/routes.ts, which mounts this file's webhook path ahead of the
// isAuthenticated middleware above by using a dedicated sub-router order.
export const rpmWebhookRouter = Router();

rpmWebhookRouter.post("/webhook/vitalfriend", async (req: Request, res: Response) => {
  const providedSecret = req.header("x-vitalfriend-webhook-secret");
  if (!verifySharedSecret(providedSecret)) {
    logHipaaAudit("WEBHOOK_AUTH_REJECTED", null, "vitalfriend_webhook", "Missing or invalid shared secret");
    return res.status(401).json({ success: false, error: "Invalid webhook credentials" });
  }

  const rawBody = (req as any).rawBody as Buffer | undefined;
  if (!rawBody) {
    return res.status(400).json({ success: false, error: "Missing request body" });
  }

  const parsed = vitalFriendPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    // Log only the validation issue paths, never the payload itself — it
    // can carry PHI (readings, device identifiers).
    console.warn(
      "[RPM Devices] VitalFriend webhook payload did not match the assumed shape:",
      parsed.error.issues.map((i) => i.path.join(".")).join(", "),
    );
    return res.status(422).json({
      success: false,
      error: "Payload did not match the expected shape — update vitalFriendPayloadSchema once you have VitalFriend's real spec",
    });
  }

  try {
    const claim = await withDeliveryClaim("vitalfriend", rawBody, async (tx) => {
      const { device_id, serial_number, readings } = parsed.data;

      const [device] = await tx
        .select()
        .from(rpmDevicesTable)
        .where(and(eq(rpmDevicesTable.provider, "vitalfriend"), eq(rpmDevicesTable.externalDeviceId, device_id)));

      if (!device || device.status === "inactive" || device.status === "error") {
        logHipaaAudit("WEBHOOK_UNKNOWN_DEVICE", null, hashIdentifier(device_id), "No enrolled/active device for this device_id");
        return { note: "No enrolled device for this device_id; ignored" };
      }

      if (device.status === "pending") {
        const serialMatches =
          !!serial_number && !!device.serialNumber && serial_number.trim() === device.serialNumber.trim();
        if (!serialMatches) {
          logHipaaAudit(
            "WEBHOOK_ACTIVATION_REJECTED",
            device.profileId,
            device.id,
            "First delivery's serial_number did not match the enrolled device; not activated, reading discarded",
          );
          return { note: "Device not yet verified; ignored" };
        }
        await tx.update(rpmDevicesTable).set({ status: "active" }).where(eq(rpmDevicesTable.id, device.id));
        logHipaaAudit("DEVICE_ACTIVATED", device.profileId, device.id, "Serial number confirmed on first delivery");
      } else if (serial_number) {
        // Re-verify on every subsequent delivery that includes a
        // serial_number — our ASSUMED spec marks the field optional, so we
        // can't require it on every call, but whenever it IS present it must
        // match. This also closes the gap for "active" rows enrolled before
        // serialNumber was a required field (their serialNumber is null and
        // can never match a provided value, so a stray/attacker delivery
        // carrying a serial_number is rejected instead of silently trusted).
        // scripts/backfill-rpm-legacy-device-reverification.ts additionally
        // resets every pre-existing active row so it has to clear the
        // activation check above at all.
        const serialMatches = !!device.serialNumber && serial_number.trim() === device.serialNumber.trim();
        if (!serialMatches) {
          logHipaaAudit(
            "WEBHOOK_SERIAL_MISMATCH",
            device.profileId,
            device.id,
            "Delivery's serial_number did not match the enrolled device; reading discarded",
          );
          return { note: "Device serial mismatch; ignored" };
        }
      }

      let ingested = 0;
      let rejectedUnit = 0;
      for (const reading of readings) {
        const vitalType = resolveVitalType(reading.vital_type);
        if (!vitalType) {
          console.warn(`[RPM Devices] Unrecognized vital_type from device ${hashIdentifier(device_id)}`);
          continue;
        }

        const normalized = normalizeUnit(vitalType, reading.value, reading.unit);
        if (!normalized) {
          console.warn(
            `[RPM Devices] Unrecognized unit "${reading.unit}" for ${vitalType} from device ${hashIdentifier(device_id)}; reading rejected rather than guessed`,
          );
          rejectedUnit++;
          continue;
        }

        await ingestVitalReading(
          {
            profileId: device.profileId,
            vitalType,
            value: normalized.value,
            unit: normalized.unit,
            recordedAt: reading.recorded_at ? new Date(reading.recorded_at) : new Date(),
            source: "vitalfriend_rpm",
            deviceId: device.id,
          },
          tx,
        );
        ingested++;
      }

      await tx
        .update(rpmDevicesTable)
        .set({ lastReadingAt: new Date() })
        .where(eq(rpmDevicesTable.id, device.id));

      logHipaaAudit(
        "READINGS_INGESTED",
        device.profileId,
        device.id,
        `${ingested}/${readings.length} readings ingested, ${rejectedUnit} rejected for unrecognized unit`,
      );

      return { ingested, rejectedUnit };
    });

    if (claim.outcome === "duplicate") {
      return res.status(200).json({ success: true, note: "Duplicate delivery, already processed" });
    }

    res.json({ success: true, ...claim.value });
  } catch (error) {
    console.error("[RPM Devices] Webhook processing error:", error);
    // withDeliveryClaim runs everything — the claim and every write above —
    // in one transaction, so a throw here rolled all of it back already,
    // including the claim itself. A retry sees a clean slate and can
    // reprocess from scratch; a transient DB failure can't leave a
    // half-written delivery behind.
    res.status(500).json({ success: false, error: "Failed to process readings, will retry" });
  }
});

export default router;
