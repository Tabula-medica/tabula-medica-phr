/**
 * HTTP surface for the Patient Operations Hub.
 *
 * ```
 * Clinic staff (acts on a patient, requireClinicStaff — same distinction
 * require-clinic-staff.ts draws for /api/care-management and /api/hcc):
 *   GET  /api/patient-operations/status?unifiedPatientId=
 *   POST /api/patient-operations/forms/assign
 *   POST /api/patient-operations/eligibility/check
 *   POST /api/patient-operations/welcome-message/send
 *
 * Patient-facing, token-based (no login required — most patients filling
 * out a new-patient intake form do not have an account yet):
 *   GET  /api/patient-operations/intake/:token
 *   POST /api/patient-operations/intake/:token/submit
 * ```
 */
import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { isAuthenticated } from "./replit_integrations/auth";
import { noStorePhi } from "./lib/middleware/no-store-phi";
import { requireClinicStaff } from "./lib/middleware/require-clinic-staff";
import { createAssignment, getAssignmentByToken, submitResponse } from "./services/patient-operations/forms-service";
import { runEligibilityCheck } from "./services/patient-operations/eligibility-bridge";
import { sendWelcomeMessage } from "./services/patient-operations/messaging-bridge";
import { getOperationsStatus } from "./services/patient-operations/status";

const operationsRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many patient-operations requests" },
});

// Separate, tighter limiter for the public token endpoints — unauthenticated, so the only
// protection against token-guessing beyond the token's own entropy is rate limiting.
const intakeRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many intake-form requests" },
});

const statusQuerySchema = z.object({
  unifiedPatientId: z.string().min(1),
  patientProfileId: z.string().optional(),
});

const assignSchema = z.object({
  unifiedPatientId: z.string().min(1),
  templateId: z.enum(["new-patient-intake", "insurance-update", "consent-to-treat"]),
});

const eligibilityCheckSchema = z.object({
  unifiedPatientId: z.string().min(1),
  request: z.object({
    patient: z.object({
      id: z.string().min(1),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      dob: z.string().min(1),
    }).passthrough(),
    coverage: z.object({
      id: z.string().min(1),
      patientId: z.string().min(1),
      payerId: z.string().min(1),
      payerName: z.string().min(1),
      memberId: z.string().min(1),
      priority: z.enum(["primary", "secondary", "tertiary"]),
      subscriberRelationship: z.enum(["self", "spouse", "child", "other"]),
    }).passthrough(),
    dateOfService: z.string().min(1),
    serviceTypeCode: z.string().optional(),
    providerNpi: z.string().min(1),
  }),
});

const welcomeMessageSchema = z.object({
  patientProfileId: z.string().min(1),
});

const submitSchema = z.object({
  answers: z.record(z.unknown()),
});

export function registerPatientOperationsRoutes(app: Express): void {
  app.use("/api/patient-operations", noStorePhi);

  app.get(
    "/api/patient-operations/status",
    isAuthenticated,
    requireClinicStaff("Patient Operations status"),
    operationsRateLimiter,
    async (req: Request, res: Response) => {
      const parsed = statusQuerySchema.safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ error: "Invalid query", detail: parsed.error.flatten() });
      const status = await getOperationsStatus(parsed.data.unifiedPatientId, parsed.data.patientProfileId);
      res.json(status);
    },
  );

  app.post(
    "/api/patient-operations/forms/assign",
    isAuthenticated,
    requireClinicStaff("Patient Operations intake-form assignment"),
    operationsRateLimiter,
    async (req: Request, res: Response) => {
      const parsed = assignSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid request", detail: parsed.error.flatten() });
      const { assignment, error } = await createAssignment(parsed.data.unifiedPatientId, parsed.data.templateId);
      if (!assignment) return res.status(400).json({ error });
      res.json(assignment);
    },
  );

  app.post(
    "/api/patient-operations/eligibility/check",
    isAuthenticated,
    requireClinicStaff("Patient Operations eligibility check"),
    operationsRateLimiter,
    async (req: Request, res: Response) => {
      const parsed = eligibilityCheckSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid request", detail: parsed.error.flatten() });
      const result = await runEligibilityCheck(parsed.data.unifiedPatientId, parsed.data.request);
      res.json(result);
    },
  );

  app.post(
    "/api/patient-operations/welcome-message/send",
    isAuthenticated,
    requireClinicStaff("Patient Operations welcome message"),
    operationsRateLimiter,
    async (req: Request, res: Response) => {
      const parsed = welcomeMessageSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid request", detail: parsed.error.flatten() });
      const result = await sendWelcomeMessage(parsed.data.patientProfileId);
      res.json(result);
    },
  );

  /** No login — the token is the secret. */
  app.get("/api/patient-operations/intake/:token", intakeRateLimiter, async (req: Request, res: Response) => {
    const { assignment, template } = await getAssignmentByToken(req.params.token);
    if (!assignment || !template) return res.status(404).json({ error: "Not found" });
    res.json({ assignment, template });
  });

  app.post("/api/patient-operations/intake/:token/submit", intakeRateLimiter, async (req: Request, res: Response) => {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request", detail: parsed.error.flatten() });
    const { response, refused } = await submitResponse(req.params.token, parsed.data.answers);
    if (!response) return res.status(422).json({ error: refused!.reason, detail: refused!.detail });
    res.json({ submitted: true, discardedFields: response.discardedFields });
  });
}
