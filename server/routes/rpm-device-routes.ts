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
 *   2. Update `parseVitalFriendPayload` below to match it exactly.
 *   3. If VitalFriend signs webhooks (HMAC) rather than using a static
 *      shared secret, replace the header check with real signature
 *      verification, mirroring verifyTerraWebhookSignature in
 *      terra-integration-service.ts.
 * Nothing here silently invents data: an unrecognized payload shape is
 * rejected with a 422 and logged, not guessed at.
 */
import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import crypto from "crypto";
import { db } from "../db";
import { rpmDevicesTable, rpmDeviceTypes, rpmDeviceProviders, type VitalSignType } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { ingestVitalReading } from "../services/vital-thresholds";

const router = Router();

function hashIdentifier(id: string): string {
  return id.slice(0, 8) + "***";
}

function logHipaaAudit(action: string, profileId: string | null, resourceId: string, details: string) {
  console.log(
    `[HIPAA-AUDIT][RPM-Devices] ${new Date().toISOString()} - ${action} - Profile:${profileId ? hashIdentifier(profileId) : "NONE"} - Resource:${resourceId} - ${details}`,
  );
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sessionUserId = (req.session as any)?.userId;
  if (!sessionUserId) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  (req as any).authenticatedUserId = sessionUserId;
  next();
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

function resolveVitalType(raw: string): VitalSignType | null {
  const normalized = raw?.toLowerCase?.().trim();
  if (!normalized) return null;
  return VITAL_TYPE_ALIASES[normalized] ?? null;
}

// --- Device enrollment (patient/caregiver self-service pairing) ---------

router.use(requireAuth);

router.get("/devices", async (req: Request, res: Response) => {
  const profileId = (req as any).authenticatedUserId;
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
  deviceType: z.enum(rpmDeviceTypes),
  externalDeviceId: z.string().min(1),
  serialNumber: z.string().optional(),
});

router.post("/devices", async (req: Request, res: Response) => {
  try {
    const profileId = (req as any).authenticatedUserId;
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
        status: "active",
        enrolledAt: new Date(),
      })
      .returning();

    logHipaaAudit("DEVICE_ENROLLED", profileId, device.id, `provider=${data.provider} type=${data.deviceType}`);

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
    const profileId = (req as any).authenticatedUserId;
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
//     "readings": [
//       { "vital_type": "blood_pressure_systolic", "value": 132, "unit": "mmHg", "recorded_at": "2026-09-20T14:00:00Z" },
//       ...
//     ]
//   }
const vitalFriendReadingSchema = z.object({
  vital_type: z.string(),
  value: z.number(),
  unit: z.string().optional(),
  recorded_at: z.string().optional(),
});
const vitalFriendPayloadSchema = z.object({
  device_id: z.string(),
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

// Mounted without requireAuth further down (VitalFriend calls this
// server-to-server, with no patient session) — see route registration in
// server/routes.ts, which mounts this file's webhook path ahead of the
// requireAuth middleware above by using a dedicated sub-router order.
export const rpmWebhookRouter = Router();

rpmWebhookRouter.post("/webhook/vitalfriend", async (req: Request, res: Response) => {
  const providedSecret = req.header("x-vitalfriend-webhook-secret");
  if (!verifySharedSecret(providedSecret)) {
    logHipaaAudit("WEBHOOK_AUTH_REJECTED", null, "vitalfriend_webhook", "Missing or invalid shared secret");
    return res.status(401).json({ success: false, error: "Invalid webhook credentials" });
  }

  const parsed = vitalFriendPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    console.warn("[RPM Devices] VitalFriend webhook payload did not match the assumed shape:", JSON.stringify(req.body));
    return res.status(422).json({
      success: false,
      error: "Payload did not match the expected shape — update parseVitalFriendPayload once you have VitalFriend's real spec",
    });
  }

  try {
    const { device_id, readings } = parsed.data;

    const [device] = await db
      .select()
      .from(rpmDevicesTable)
      .where(and(eq(rpmDevicesTable.provider, "vitalfriend"), eq(rpmDevicesTable.externalDeviceId, device_id)));

    if (!device || device.status !== "active") {
      logHipaaAudit("WEBHOOK_UNKNOWN_DEVICE", null, device_id, "No active enrollment for this device_id");
      return res.status(200).json({ success: true, note: "No active enrollment for this device; ignored" });
    }

    let ingested = 0;
    for (const reading of readings) {
      const vitalType = resolveVitalType(reading.vital_type);
      if (!vitalType) {
        console.warn(`[RPM Devices] Unrecognized vital_type "${reading.vital_type}" from device ${device_id}`);
        continue;
      }

      await ingestVitalReading({
        profileId: device.profileId,
        vitalType,
        value: reading.value,
        unit: reading.unit || vitalTypeDefaultUnit(vitalType),
        recordedAt: reading.recorded_at ? new Date(reading.recorded_at) : new Date(),
        source: "vitalfriend_rpm",
        deviceId: device.id,
      });
      ingested++;
    }

    await db
      .update(rpmDevicesTable)
      .set({ lastReadingAt: new Date() })
      .where(eq(rpmDevicesTable.id, device.id));

    logHipaaAudit("READINGS_INGESTED", device.profileId, device.id, `${ingested}/${readings.length} readings ingested`);

    res.json({ success: true, ingested });
  } catch (error) {
    console.error("[RPM Devices] Webhook processing error:", error);
    res.status(500).json({ success: false, error: "Failed to process readings" });
  }
});

function vitalTypeDefaultUnit(vitalType: VitalSignType): string {
  const units: Record<VitalSignType, string> = {
    blood_pressure_systolic: "mmHg",
    blood_pressure_diastolic: "mmHg",
    heart_rate: "bpm",
    blood_glucose: "mg/dL",
    weight: "lbs",
    temperature: "°F",
    oxygen_saturation: "%",
    respiratory_rate: "breaths/min",
  };
  return units[vitalType];
}

export default router;
