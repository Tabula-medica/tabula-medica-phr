/**
 * One codebase, two deployments. `TABULA_REGION=world` is the international
 * product. TEFCA (and the Fasten US network that rides on it) stays on only
 * for the US deployment. An explicit `TEFCA_ENABLED=false` still turns TEFCA
 * off in the US. Setting `TEFCA_ENABLED=true` cannot turn it on for world.
 */

export const DEPLOYMENT_REGIONS = ["us", "world"] as const;
export type DeploymentRegion = (typeof DEPLOYMENT_REGIONS)[number];

export interface DeploymentEnv {
  TABULA_REGION?: string;
  TEFCA_ENABLED?: string;
}

export interface DeploymentConfig {
  region: DeploymentRegion;
  tefcaEnabled: boolean;
}

export function parseDeploymentRegion(raw: string | undefined | null): DeploymentRegion {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "world" || value === "international" || value === "intl") return "world";
  return "us";
}

export function resolveDeployment(env: DeploymentEnv): DeploymentConfig {
  const region = parseDeploymentRegion(env.TABULA_REGION);
  if (region === "world") return { region, tefcaEnabled: false };
  return { region, tefcaEnabled: env.TEFCA_ENABLED !== "false" };
}
