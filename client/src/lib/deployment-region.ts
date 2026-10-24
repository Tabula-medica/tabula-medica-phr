import { parseDeploymentRegion, type DeploymentRegion } from "@shared/deployment-region";

/** Build-time hint. The server's `/api/public-config` response is authoritative. */
export function buildTimeRegion(): DeploymentRegion {
  const raw = import.meta.env.VITE_TABULA_REGION;
  return parseDeploymentRegion(typeof raw === "string" ? raw : undefined);
}
