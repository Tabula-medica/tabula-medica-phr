import { storage } from "./storage";
import type { InsertHealthRecord } from "@shared/schema";

export interface FhirAuthConfig {
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

export interface FhirCapabilityStatement {
  resourceType: string;
  fhirVersion: string;
  rest?: Array<{
    mode: string;
    security?: {
      extension?: Array<{
        url: string;
        extension?: Array<{
          url: string;
          valueUri?: string;
        }>;
      }>;
    };
    resource?: Array<{
      type: string;
      interaction?: Array<{ code: string }>;
    }>;
  }>;
}

export async function discoverSmartEndpoints(fhirBaseUrl: string): Promise<FhirAuthConfig | null> {
  try {
    const metadataUrl = `${fhirBaseUrl}/metadata`;
    const response = await fetch(metadataUrl, {
      headers: { Accept: "application/fhir+json" },
    });

    if (!response.ok) {
      console.error(`Failed to fetch FHIR metadata: ${response.status}`);
      return null;
    }

    const capability: FhirCapabilityStatement = await response.json();

    const security = capability.rest?.[0]?.security;
    const smartExtension = security?.extension?.find(
      (ext) => ext.url === "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris"
    );

    if (!smartExtension) {
      console.error("SMART on FHIR not supported by this server");
      return null;
    }

    const authorizationUrl = smartExtension.extension?.find((e) => e.url === "authorize")?.valueUri;
    const tokenUrl = smartExtension.extension?.find((e) => e.url === "token")?.valueUri;

    if (!authorizationUrl || !tokenUrl) {
      console.error("Missing authorization or token URL");
      return null;
    }

    return {
      authorizationUrl,
      tokenUrl,
      clientId: "",
      redirectUri: "",
      scopes: [
        "openid",
        "fhirUser",
        "launch/patient",
        "patient/Patient.read",
        "patient/Observation.read",
        "patient/Condition.read",
        "patient/MedicationRequest.read",
        "patient/Immunization.read",
        "patient/Encounter.read",
        "patient/Procedure.read",
        "patient/AllergyIntolerance.read",
        "patient/DocumentReference.read",
      ],
    };
  } catch (error) {
    console.error("Error discovering SMART endpoints:", error);
    return null;
  }
}

export function buildAuthorizationUrl(config: FhirAuthConfig, state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(" "),
    state,
    aud: config.redirectUri.replace("/callback", "").replace("https://", "https://fhir."),
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${config.authorizationUrl}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  tokenUrl: string,
  code: string,
  clientId: string,
  redirectUri: string,
  codeVerifier: string
): Promise<{ accessToken: string; refreshToken?: string; patientId?: string; expiresIn?: number } | null> {
  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      console.error(`Token exchange failed: ${response.status}`);
      return null;
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      patientId: data.patient,
      expiresIn: data.expires_in,
    };
  } catch (error) {
    console.error("Error exchanging code for token:", error);
    return null;
  }
}

export async function fetchFhirResources(
  fhirBaseUrl: string,
  accessToken: string,
  patientId: string,
  resourceTypes: string[]
): Promise<Map<string, any[]>> {
  const results = new Map<string, any[]>();

  for (const resourceType of resourceTypes) {
    try {
      const url = `${fhirBaseUrl}/${resourceType}?patient=${patientId}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/fhir+json",
        },
      });

      if (response.ok) {
        const bundle = await response.json();
        const entries = bundle.entry?.map((e: any) => e.resource) || [];
        results.set(resourceType, entries);
      } else {
        console.warn(`Failed to fetch ${resourceType}: ${response.status}`);
        results.set(resourceType, []);
      }
    } catch (error) {
      console.error(`Error fetching ${resourceType}:`, error);
      results.set(resourceType, []);
    }
  }

  return results;
}

export function mapFhirToHealthRecord(
  resource: any,
  userId: string,
  sourceId: string
): InsertHealthRecord | null {
  const resourceType = resource.resourceType;

  switch (resourceType) {
    case "Observation":
      return mapObservation(resource, userId, sourceId);
    case "Condition":
      return mapCondition(resource, userId, sourceId);
    case "MedicationRequest":
      return mapMedicationRequest(resource, userId, sourceId);
    case "MedicationStatement":
      return mapMedicationStatement(resource, userId, sourceId);
    case "Immunization":
      return mapImmunization(resource, userId, sourceId);
    case "Encounter":
      return mapEncounter(resource, userId, sourceId);
    case "Procedure":
      return mapProcedure(resource, userId, sourceId);
    case "AllergyIntolerance":
      return mapAllergyIntolerance(resource, userId, sourceId);
    case "DiagnosticReport":
      return mapDiagnosticReport(resource, userId, sourceId);
    default:
      return null;
  }
}

function mapObservation(resource: any, userId: string, sourceId: string): InsertHealthRecord {
  const category = resource.category?.[0]?.coding?.[0]?.code;
  const isVital = category === "vital-signs";
  const isLab = category === "laboratory";

  const value = resource.valueQuantity
    ? `${resource.valueQuantity.value} ${resource.valueQuantity.unit || ""}`
    : resource.valueString || resource.valueCodeableConcept?.text || "";

  return {
    userId,
    type: isVital ? "vital" : "lab",
    title: resource.code?.text || resource.code?.coding?.[0]?.display || "Observation",
    summary: value,
    date: new Date(resource.effectiveDateTime || resource.issued || new Date()),
    provider: resource.performer?.[0]?.display || null,
    facility: null,
    sourceId,
    fhirResourceType: "Observation",
    fhirResourceId: resource.id,
    isManual: false,
    details: {
      code: resource.code?.coding?.[0]?.code,
      system: resource.code?.coding?.[0]?.system,
      value: resource.valueQuantity?.value,
      unit: resource.valueQuantity?.unit,
      referenceRange: resource.referenceRange?.[0],
    },
    rawFhirJson: resource,
    lastSyncedAt: new Date(),
  };
}

function mapCondition(resource: any, userId: string, sourceId: string): InsertHealthRecord {
  return {
    userId,
    type: "condition",
    title: resource.code?.text || resource.code?.coding?.[0]?.display || "Condition",
    summary: resource.clinicalStatus?.coding?.[0]?.code || "Unknown status",
    date: new Date(resource.onsetDateTime || resource.recordedDate || new Date()),
    provider: resource.asserter?.display || null,
    facility: null,
    sourceId,
    fhirResourceType: "Condition",
    fhirResourceId: resource.id,
    isManual: false,
    details: {
      code: resource.code?.coding?.[0]?.code,
      system: resource.code?.coding?.[0]?.system,
      clinicalStatus: resource.clinicalStatus?.coding?.[0]?.code,
      verificationStatus: resource.verificationStatus?.coding?.[0]?.code,
    },
    rawFhirJson: resource,
    lastSyncedAt: new Date(),
  };
}

function mapMedicationRequest(resource: any, userId: string, sourceId: string): InsertHealthRecord {
  const medicationName =
    resource.medicationCodeableConcept?.text ||
    resource.medicationCodeableConcept?.coding?.[0]?.display ||
    "Medication";

  const dosage = resource.dosageInstruction?.[0];
  const dosageText = dosage?.text || dosage?.doseAndRate?.[0]?.doseQuantity?.value
    ? `${dosage.doseAndRate[0].doseQuantity.value} ${dosage.doseAndRate[0].doseQuantity.unit || ""}`
    : "";

  return {
    userId,
    type: "medication",
    title: medicationName,
    summary: dosageText,
    date: new Date(resource.authoredOn || new Date()),
    provider: resource.requester?.display || null,
    facility: null,
    sourceId,
    fhirResourceType: "MedicationRequest",
    fhirResourceId: resource.id,
    isManual: false,
    details: {
      status: resource.status,
      intent: resource.intent,
      dosageInstruction: resource.dosageInstruction,
    },
    rawFhirJson: resource,
    lastSyncedAt: new Date(),
  };
}

function mapMedicationStatement(resource: any, userId: string, sourceId: string): InsertHealthRecord {
  const medicationName =
    resource.medicationCodeableConcept?.text ||
    resource.medicationCodeableConcept?.coding?.[0]?.display ||
    "Medication";

  return {
    userId,
    type: "medication",
    title: medicationName,
    summary: resource.dosage?.[0]?.text || "",
    date: new Date(resource.effectiveDateTime || resource.dateAsserted || new Date()),
    provider: resource.informationSource?.display || null,
    facility: null,
    sourceId,
    fhirResourceType: "MedicationStatement",
    fhirResourceId: resource.id,
    isManual: false,
    details: {
      status: resource.status,
      dosage: resource.dosage,
    },
    rawFhirJson: resource,
    lastSyncedAt: new Date(),
  };
}

function mapImmunization(resource: any, userId: string, sourceId: string): InsertHealthRecord {
  return {
    userId,
    type: "immunization",
    title: resource.vaccineCode?.text || resource.vaccineCode?.coding?.[0]?.display || "Immunization",
    summary: resource.status || "",
    date: new Date(resource.occurrenceDateTime || new Date()),
    provider: resource.performer?.[0]?.actor?.display || null,
    facility: resource.location?.display || null,
    sourceId,
    fhirResourceType: "Immunization",
    fhirResourceId: resource.id,
    isManual: false,
    details: {
      status: resource.status,
      lotNumber: resource.lotNumber,
      site: resource.site?.coding?.[0]?.display,
      route: resource.route?.coding?.[0]?.display,
    },
    rawFhirJson: resource,
    lastSyncedAt: new Date(),
  };
}

function mapEncounter(resource: any, userId: string, sourceId: string): InsertHealthRecord {
  const type = resource.type?.[0]?.text || resource.type?.[0]?.coding?.[0]?.display || "Visit";

  return {
    userId,
    type: "visit",
    title: type,
    summary: resource.reasonCode?.[0]?.text || resource.reasonCode?.[0]?.coding?.[0]?.display || "",
    date: new Date(resource.period?.start || new Date()),
    provider: resource.participant?.[0]?.individual?.display || null,
    facility: resource.serviceProvider?.display || null,
    sourceId,
    fhirResourceType: "Encounter",
    fhirResourceId: resource.id,
    isManual: false,
    details: {
      status: resource.status,
      class: resource.class?.display || resource.class?.code,
      reasonCode: resource.reasonCode,
    },
    rawFhirJson: resource,
    lastSyncedAt: new Date(),
  };
}

function mapProcedure(resource: any, userId: string, sourceId: string): InsertHealthRecord {
  return {
    userId,
    type: "procedure",
    title: resource.code?.text || resource.code?.coding?.[0]?.display || "Procedure",
    summary: resource.outcome?.text || resource.status || "",
    date: new Date(resource.performedDateTime || resource.performedPeriod?.start || new Date()),
    provider: resource.performer?.[0]?.actor?.display || null,
    facility: resource.location?.display || null,
    sourceId,
    fhirResourceType: "Procedure",
    fhirResourceId: resource.id,
    isManual: false,
    details: {
      status: resource.status,
      bodySite: resource.bodySite?.[0]?.text,
      outcome: resource.outcome?.text,
    },
    rawFhirJson: resource,
    lastSyncedAt: new Date(),
  };
}

function mapAllergyIntolerance(resource: any, userId: string, sourceId: string): InsertHealthRecord {
  return {
    userId,
    type: "allergy",
    title: resource.code?.text || resource.code?.coding?.[0]?.display || "Allergy",
    summary: resource.reaction?.[0]?.manifestation?.[0]?.text ||
      resource.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display || "",
    date: new Date(resource.onsetDateTime || resource.recordedDate || new Date()),
    provider: resource.recorder?.display || null,
    facility: null,
    sourceId,
    fhirResourceType: "AllergyIntolerance",
    fhirResourceId: resource.id,
    isManual: false,
    details: {
      clinicalStatus: resource.clinicalStatus?.coding?.[0]?.code,
      verificationStatus: resource.verificationStatus?.coding?.[0]?.code,
      type: resource.type,
      category: resource.category,
      criticality: resource.criticality,
    },
    rawFhirJson: resource,
    lastSyncedAt: new Date(),
  };
}

function mapDiagnosticReport(resource: any, userId: string, sourceId: string): InsertHealthRecord {
  const category = resource.category?.[0]?.coding?.[0]?.code;
  const isImaging = category === "imaging" || category === "RAD";

  return {
    userId,
    type: isImaging ? "imaging" : "lab",
    title: resource.code?.text || resource.code?.coding?.[0]?.display || "Diagnostic Report",
    summary: resource.conclusion || "",
    date: new Date(resource.effectiveDateTime || resource.issued || new Date()),
    provider: resource.performer?.[0]?.display || null,
    facility: null,
    sourceId,
    fhirResourceType: "DiagnosticReport",
    fhirResourceId: resource.id,
    isManual: false,
    details: {
      status: resource.status,
      category: resource.category?.[0]?.text,
      conclusion: resource.conclusion,
    },
    rawFhirJson: resource,
    lastSyncedAt: new Date(),
  };
}

export async function syncFhirDataSource(sourceId: string): Promise<number> {
  const source = await storage.getDataSource(sourceId);
  if (!source || !source.fhirEndpoint || !source.accessToken || !source.patientId) {
    return 0;
  }

  const resourceTypes = [
    "Observation",
    "Condition",
    "MedicationRequest",
    "MedicationStatement",
    "Immunization",
    "Encounter",
    "Procedure",
    "AllergyIntolerance",
    "DiagnosticReport",
  ];

  const resources = await fetchFhirResources(
    source.fhirEndpoint,
    source.accessToken,
    source.patientId,
    resourceTypes
  );

  let importedCount = 0;

  for (const [resourceType, items] of resources) {
    for (const resource of items) {
      const record = mapFhirToHealthRecord(resource, source.userId, source.id);
      if (record) {
        await storage.createHealthRecord(record);
        importedCount++;
      }
    }
  }

  await storage.updateDataSource(sourceId, {
    lastSyncAt: new Date(),
    recordCount: importedCount,
  });

  return importedCount;
}
