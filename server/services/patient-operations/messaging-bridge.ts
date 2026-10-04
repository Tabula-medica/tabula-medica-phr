/**
 * Thin wrapper over the real, DB-backed secure messaging system
 * (`patient-engagement-service.ts` / `engagementMessageThreadsTable` +
 * `engagementMessagesTable`) — never `server/messaging-routes.ts`, which is
 * reachable from routes.ts but keeps every conversation in a process-local
 * `Map` with no `db`/`phiDb` import at all.
 *
 * This only works when the unifiedPatientId has a linked, logged-in
 * `profiles.id` (a patient account) — most newly-onboarded or EHR-synced
 * patients will not have one yet, since no mapping from unifiedPatientId to
 * profiles.id exists in this codebase. Callers must pass the profile id
 * explicitly when they have it (e.g. the patient is filling out the intake
 * form from their own logged-in session); this module never guesses one.
 */
import { eq, and } from "drizzle-orm";
import { phiDb } from "../../storage/phi-storage";
import { engagementMessageThreadsTable, engagementMessagesTable } from "@shared/schema";
import { patientEngagementService } from "../patient-engagement-service";

const SYSTEM_PROVIDER_USER_ID = "patient-operations-system";
const SYSTEM_PROVIDER_NAME = "Patient Operations";
const WELCOME_SUBJECT = "Welcome — next steps for your care";

export async function sendWelcomeMessage(patientProfileId: string): Promise<{ sent: boolean; reason?: string }> {
  const already = await hasSentWelcomeMessage(patientProfileId);
  if (already) return { sent: false, reason: "Welcome message already sent for this profile." };

  const thread = await patientEngagementService.createMessageThread({
    patientProfileId,
    providerUserId: SYSTEM_PROVIDER_USER_ID,
    providerName: SYSTEM_PROVIDER_NAME,
    subject: WELCOME_SUBJECT,
    category: "general",
    priority: "normal",
  });

  await patientEngagementService.sendMessage({
    threadId: thread.id,
    senderType: "system",
    senderId: SYSTEM_PROVIDER_USER_ID,
    senderName: SYSTEM_PROVIDER_NAME,
    content:
      "Welcome! To finish getting set up, please complete any intake forms your clinic has sent you " +
      "and keep your insurance information up to date. Reply here if you have questions.",
  });

  return { sent: true };
}

export async function hasSentWelcomeMessage(patientProfileId: string): Promise<boolean> {
  const rows = await phiDb
    .select({ id: engagementMessagesTable.id })
    .from(engagementMessagesTable)
    .innerJoin(engagementMessageThreadsTable, eq(engagementMessagesTable.threadId, engagementMessageThreadsTable.id))
    .where(
      and(
        eq(engagementMessageThreadsTable.patientProfileId, patientProfileId),
        eq(engagementMessageThreadsTable.providerUserId, SYSTEM_PROVIDER_USER_ID),
        eq(engagementMessageThreadsTable.subject, WELCOME_SUBJECT),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
