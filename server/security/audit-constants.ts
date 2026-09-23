/**
 * SYSTEM_ACTOR — canonical sentinel for audit log fields where no human
 * user is present (cron jobs, background services, monitoring probes).
 * Use ONLY in audit/log metadata — NEVER as an access-control identity.
 */
export const SYSTEM_ACTOR = "system" as const;
