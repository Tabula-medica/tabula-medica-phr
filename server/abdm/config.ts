// ABDM (India) config for the Tabula PHR. Mirrors the WorldEHR ABDM lib (omnihealth-ehr
// api/src/config.ts abdm block). Env-driven; secrets from the platform secret store, never committed.
// Default off / stub so nothing changes until ABDM_ENABLED + creds are provisioned.
//
// NOTE: a PHR application in ABDM typically registers SEPARATELY from a HIP/HIU bridge — use the
// PHR's own client id/secret here, not the EHR's SBXID_070205. Calls geo-fence to India → set
// ABDM_HTTPS_PROXY to the Mumbai proxy in production.
export const abdmConfig = {
  enabled: (process.env.ABDM_ENABLED ?? "false").toLowerCase() === "true",
  baseUrl: process.env.ABDM_BASE_URL ?? "https://dev.abdm.gov.in", // gateway/HIECM host
  abhaBaseUrl: process.env.ABDM_ABHA_BASE_URL ?? "https://abhasbx.abdm.gov.in/abha/api", // ABHA service
  clientId: process.env.ABDM_CLIENT_ID ?? "",
  clientSecret: process.env.ABDM_CLIENT_SECRET ?? "",
  cmId: process.env.ABDM_CM_ID ?? "sbx", // X-CM-ID: "sbx" sandbox
  httpsProxy: process.env.ABDM_HTTPS_PROXY ?? "", // India egress proxy
};
