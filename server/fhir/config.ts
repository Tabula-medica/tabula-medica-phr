import type { EhrPlatform, FhirConfig } from "@shared/schema";

export type FhirConnectionMode = "sandbox" | "live";

export interface FhirEndpointPreset {
  platform: EhrPlatform;
  name: string;
  sandboxConfig: FhirConfig;
  productionConfig: FhirConfig;
}

export interface HospitalEndpoint {
  id: string;
  name: string;
  platform: EhrPlatform;
  fhirBaseUrl: string;
  city: string;
  state: string;
  system: string;
}

export function getFhirConnectionMode(): FhirConnectionMode {
  const envMode = process.env.FHIR_CONNECTION_MODE;
  if (envMode === "live") return "live";
  if (envMode === "sandbox") return "sandbox";
  return process.env.FASTEN_HEALTH_CLIENT_ID ? "live" : "sandbox";
}

export function getActiveConfig(preset: FhirEndpointPreset): FhirConfig {
  const mode = getFhirConnectionMode();
  const config = mode === "live" ? preset.productionConfig : preset.sandboxConfig;

  const platformEnvMap: Record<string, { clientIdEnv: string; secretEnv: string }> = {
    fastenhealth: { clientIdEnv: "FASTEN_HEALTH_CLIENT_ID", secretEnv: "FASTEN_HEALTH_API_KEY" },
    epic: { clientIdEnv: "EPIC_CLIENT_ID", secretEnv: "EPIC_CLIENT_SECRET" },
    ecw: { clientIdEnv: "ECW_CLIENT_ID", secretEnv: "ECW_CLIENT_SECRET" },
    athena: { clientIdEnv: "ATHENA_CLIENT_ID", secretEnv: "ATHENA_CLIENT_SECRET" },
    meditech: { clientIdEnv: "MEDITECH_CLIENT_ID", secretEnv: "MEDITECH_CLIENT_SECRET" },
  };

  const envKeys = platformEnvMap[preset.platform];
  const envClientId = envKeys ? process.env[envKeys.clientIdEnv] : undefined;
  const envClientSecret = envKeys ? process.env[envKeys.secretEnv] : undefined;

  return {
    ...config,
    ...(envClientId ? { clientId: envClientId } : {}),
    ...(envClientSecret ? { clientSecret: envClientSecret } : {}),
  };
}

const SMART_FHIR_SCOPES = [
  "launch/patient",
  "patient/Patient.read",
  "patient/Condition.read",
  "patient/Observation.read",
  "patient/MedicationRequest.read",
  "patient/DiagnosticReport.read",
  "patient/AllergyIntolerance.read",
  "patient/Immunization.read",
  "patient/Procedure.read",
  "patient/Encounter.read",
  "patient/DocumentReference.read",
  "patient/CarePlan.read",
  "patient/CareTeam.read",
  "patient/Goal.read",
  "openid",
  "fhirUser",
];

const EPIC_SCOPES = [
  "launch/patient",
  "patient/Patient.read",
  "patient/Condition.read",
  "patient/Observation.read",
  "patient/MedicationRequest.read",
  "patient/DiagnosticReport.read",
  "patient/AllergyIntolerance.read",
  "patient/Immunization.read",
  "patient/Procedure.read",
  "patient/Encounter.read",
  "patient/DocumentReference.read",
  "patient/CarePlan.read",
  "patient/CareTeam.read",
  "patient/Goal.read",
  "patient/Medication.read",
  "openid",
  "fhirUser",
];

export const FHIR_PRESETS: Record<EhrPlatform, FhirEndpointPreset> = {
  fastenhealth: {
    platform: "fastenhealth",
    name: "Fasten Health",
    sandboxConfig: {
      fhirBaseUrl: "https://api.connect.fastenhealth.com/v1/fhir",
      authorizationEndpoint: "https://api.connect.fastenhealth.com/v1/oauth/authorize",
      tokenEndpoint: "https://api.connect.fastenhealth.com/v1/oauth/token",
      issuer: "https://api.connect.fastenhealth.com",
      scopes: SMART_FHIR_SCOPES,
      usePkce: true,
    },
    productionConfig: {
      fhirBaseUrl: "https://api.connect.fastenhealth.com/v1/fhir",
      authorizationEndpoint: "https://api.connect.fastenhealth.com/v1/oauth/authorize",
      tokenEndpoint: "https://api.connect.fastenhealth.com/v1/oauth/token",
      issuer: "https://api.connect.fastenhealth.com",
      scopes: SMART_FHIR_SCOPES,
      usePkce: true,
    },
  },

  epic: {
    platform: "epic",
    name: "Epic MyChart",
    sandboxConfig: {
      fhirBaseUrl: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4",
      authorizationEndpoint: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize",
      tokenEndpoint: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token",
      issuer: "https://fhir.epic.com",
      scopes: EPIC_SCOPES,
      usePkce: true,
    },
    productionConfig: {
      fhirBaseUrl: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4",
      authorizationEndpoint: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize",
      tokenEndpoint: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token",
      issuer: "https://fhir.epic.com",
      scopes: EPIC_SCOPES,
      usePkce: true,
    },
  },

  ecw: {
    platform: "ecw",
    name: "eClinicalWorks",
    sandboxConfig: {
      fhirBaseUrl: "https://fhir4.eclinicalworks.com/fhir/r4/IJCEAI",
      authorizationEndpoint: "https://oauthserver.eclinicalworks.com/oauth/authorize",
      tokenEndpoint: "https://oauthserver.eclinicalworks.com/oauth/token",
      issuer: "https://oauthserver.eclinicalworks.com",
      scopes: SMART_FHIR_SCOPES,
      usePkce: true,
    },
    productionConfig: {
      fhirBaseUrl: "https://fhir4.eclinicalworks.com/fhir/r4/IJCEAI",
      authorizationEndpoint: "https://oauthserver.eclinicalworks.com/oauth/authorize",
      tokenEndpoint: "https://oauthserver.eclinicalworks.com/oauth/token",
      issuer: "https://oauthserver.eclinicalworks.com",
      scopes: SMART_FHIR_SCOPES,
      usePkce: true,
    },
  },

  athena: {
    platform: "athena",
    name: "athenahealth",
    sandboxConfig: {
      fhirBaseUrl: "https://api.platform.athenahealth.com/fhir/r4",
      authorizationEndpoint: "https://api.platform.athenahealth.com/oauth2/v1/authorize",
      tokenEndpoint: "https://api.platform.athenahealth.com/oauth2/v1/token",
      issuer: "https://api.platform.athenahealth.com",
      scopes: SMART_FHIR_SCOPES,
      usePkce: true,
    },
    productionConfig: {
      fhirBaseUrl: "https://api.platform.athenahealth.com/fhir/r4",
      authorizationEndpoint: "https://api.platform.athenahealth.com/oauth2/v1/authorize",
      tokenEndpoint: "https://api.platform.athenahealth.com/oauth2/v1/token",
      issuer: "https://api.platform.athenahealth.com",
      scopes: SMART_FHIR_SCOPES,
      usePkce: true,
    },
  },

  meditech: {
    platform: "meditech",
    name: "MEDITECH Expanse",
    sandboxConfig: {
      fhirBaseUrl: "https://fhir.meditech.com/explorer/r4",
      authorizationEndpoint: "https://fhir.meditech.com/oauth/authorize",
      tokenEndpoint: "https://fhir.meditech.com/oauth/token",
      issuer: "https://fhir.meditech.com",
      scopes: SMART_FHIR_SCOPES,
      usePkce: true,
    },
    productionConfig: {
      fhirBaseUrl: "https://fhir.meditech.com/explorer/r4",
      authorizationEndpoint: "https://fhir.meditech.com/oauth/authorize",
      tokenEndpoint: "https://fhir.meditech.com/oauth/token",
      issuer: "https://fhir.meditech.com",
      scopes: SMART_FHIR_SCOPES,
      usePkce: true,
    },
  },
};

export const VIRGINIA_HOSPITALS: HospitalEndpoint[] = [
  {
    id: "inova-fairfax",
    name: "Inova Fairfax Medical Campus",
    platform: "epic",
    fhirBaseUrl: "https://epicrpprd.inova.org/fhirrp/api/FHIR/R4/",
    city: "Falls Church",
    state: "VA",
    system: "Inova Health System",
  },
  {
    id: "inova-alexandria",
    name: "Inova Alexandria Hospital",
    platform: "epic",
    fhirBaseUrl: "https://epicrpprd.inova.org/fhirrp/api/FHIR/R4/",
    city: "Alexandria",
    state: "VA",
    system: "Inova Health System",
  },
  {
    id: "inova-loudoun",
    name: "Inova Loudoun Hospital",
    platform: "epic",
    fhirBaseUrl: "https://epicrpprd.inova.org/fhirrp/api/FHIR/R4/",
    city: "Leesburg",
    state: "VA",
    system: "Inova Health System",
  },
  {
    id: "inova-mount-vernon",
    name: "Inova Mount Vernon Hospital",
    platform: "epic",
    fhirBaseUrl: "https://epicrpprd.inova.org/fhirrp/api/FHIR/R4/",
    city: "Alexandria",
    state: "VA",
    system: "Inova Health System",
  },
  {
    id: "inova-fair-oaks",
    name: "Inova Fair Oaks Hospital",
    platform: "epic",
    fhirBaseUrl: "https://epicrpprd.inova.org/fhirrp/api/FHIR/R4/",
    city: "Fairfax",
    state: "VA",
    system: "Inova Health System",
  },
  {
    id: "uva-health",
    name: "UVA Health",
    platform: "epic",
    fhirBaseUrl: "https://hscsesoap.hscs.virginia.edu/FHIRProxy/api/FHIR/R4/",
    city: "Charlottesville",
    state: "VA",
    system: "University of Virginia Health System",
  },
  {
    id: "sentara-norfolk",
    name: "Sentara Norfolk General Hospital",
    platform: "epic",
    fhirBaseUrl: "https://epicfhir.sentara.com/ARR-FHIR-PRD/api/FHIR/R4/",
    city: "Norfolk",
    state: "VA",
    system: "Sentara Healthcare",
  },
  {
    id: "sentara-virginia-beach",
    name: "Sentara Virginia Beach General Hospital",
    platform: "epic",
    fhirBaseUrl: "https://epicfhir.sentara.com/ARR-FHIR-PRD/api/FHIR/R4/",
    city: "Virginia Beach",
    state: "VA",
    system: "Sentara Healthcare",
  },
  {
    id: "sentara-leigh",
    name: "Sentara Leigh Hospital",
    platform: "epic",
    fhirBaseUrl: "https://epicfhir.sentara.com/ARR-FHIR-PRD/api/FHIR/R4/",
    city: "Norfolk",
    state: "VA",
    system: "Sentara Healthcare",
  },
  {
    id: "sentara-williamsburg",
    name: "Sentara Williamsburg Regional Medical Center",
    platform: "epic",
    fhirBaseUrl: "https://epicfhir.sentara.com/ARR-FHIR-PRD/api/FHIR/R4/",
    city: "Williamsburg",
    state: "VA",
    system: "Sentara Healthcare",
  },
];

export function getVirginiaHospitals(): HospitalEndpoint[] {
  return VIRGINIA_HOSPITALS;
}

export function findHospitalById(id: string): HospitalEndpoint | undefined {
  return VIRGINIA_HOSPITALS.find((h) => h.id === id);
}

export function searchHospitals(query: string): HospitalEndpoint[] {
  const q = query.toLowerCase();
  return VIRGINIA_HOSPITALS.filter(
    (h) =>
      h.name.toLowerCase().includes(q) ||
      h.city.toLowerCase().includes(q) ||
      h.system.toLowerCase().includes(q)
  );
}

export function getFhirPreset(platform: EhrPlatform): FhirEndpointPreset {
  return FHIR_PRESETS[platform];
}
