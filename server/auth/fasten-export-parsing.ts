/**
 * Pure helpers for ingesting Fasten EHI-export webhook events. No db/storage
 * imports so the parsing rules stay unit-testable in isolation.
 *
 * Fasten posts webhook events to /api/fasten-connect/webhook. The export
 * payload shape is defensively extracted from several plausible key paths
 * (the handler logs the full event JSON, so any unrecognized shape can be
 * read from the HIPAA-AUDIT logs and a new path added here).
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface FastenExportPayload {
  orgConnectionId: string;
  taskId: string | null;
  downloadUrl: string | null;
}

/** True for the webhook event that signals a finished EHI export. */
export function isFastenExportSuccessEvent(event: unknown): boolean {
  const e = event as Record<string, unknown> | null;
  const type = String(e?.event_type ?? e?.type ?? "").toLowerCase();
  return (
    type.includes("ehi_export") &&
    (type.includes("success") || type.includes("complete"))
  );
}

function firstString(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

/**
 * Pull the connection id, task id, and export download URL out of a webhook
 * event, tolerating the payload living at the top level or under `data`.
 * Returns null when no valid org_connection_id can be found.
 */
export function extractExportPayload(event: unknown): FastenExportPayload | null {
  const e = (event ?? {}) as Record<string, any>;
  const data = (e.data ?? {}) as Record<string, any>;

  const orgConnectionId = firstString(
    data.org_connection_id,
    e.org_connection_id,
    data.connection_id,
    e.connection_id,
    data.org_connection?.id,
  );
  if (!orgConnectionId || !UUID_RE.test(orgConnectionId)) return null;

  return {
    orgConnectionId,
    taskId: firstString(data.task_id, e.task_id),
    downloadUrl: firstString(
      data.download_link,
      data.download_url,
      e.download_link,
      e.download_url,
      data.url,
    ),
  };
}

/**
 * The export download URL comes from an (HMAC-verifiable but by default
 * log-only) webhook, so before fetching it server-side with our API
 * credentials, require https and a fastenhealth.com host — otherwise the
 * webhook becomes an SSRF/credential-leak vector.
 */
export function isAllowedFastenDownloadUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  return host === "fastenhealth.com" || host.endsWith(".fastenhealth.com");
}

export interface FhirResourceBuckets {
  patient: any | null;
  conditions: any[];
  observations: any[];
  medications: any[];
  allergies: any[];
  procedures: any[];
  encounters: any[];
  immunizations: any[];
  other: number;
}

/**
 * Parse an export body into FHIR resources. Accepts a Bundle, a bare array
 * of resources, a single resource, or NDJSON (one resource per line).
 */
export function parseFhirResources(text: string): any[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.filter(r => r?.resourceType);
    if (parsed?.resourceType === "Bundle") {
      return (parsed.entry ?? [])
        .map((entry: any) => entry?.resource)
        .filter((r: any) => r?.resourceType);
    }
    if (parsed?.resourceType) return [parsed];
    return [];
  } catch {
    // NDJSON: parse line by line, skipping anything malformed.
    return trimmed
      .split(/\r?\n/)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(r => r?.resourceType);
  }
}

/** Group parsed resources into the buckets the FHIR sync mappers expect. */
export function bucketResources(resources: any[]): FhirResourceBuckets {
  const buckets: FhirResourceBuckets = {
    patient: null,
    conditions: [],
    observations: [],
    medications: [],
    allergies: [],
    procedures: [],
    encounters: [],
    immunizations: [],
    other: 0,
  };
  for (const resource of resources) {
    switch (resource.resourceType) {
      case "Patient":
        buckets.patient = buckets.patient ?? resource;
        break;
      case "Condition":
        buckets.conditions.push(resource);
        break;
      case "Observation":
        buckets.observations.push(resource);
        break;
      case "MedicationRequest":
        buckets.medications.push(resource);
        break;
      case "AllergyIntolerance":
        buckets.allergies.push(resource);
        break;
      case "Procedure":
        buckets.procedures.push(resource);
        break;
      case "Encounter":
        buckets.encounters.push(resource);
        break;
      case "Immunization":
        buckets.immunizations.push(resource);
        break;
      default:
        buckets.other++;
    }
  }
  return buckets;
}
