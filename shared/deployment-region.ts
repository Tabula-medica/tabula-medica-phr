/**
 * One codebase. US and World are deployment modes, not forks.
 *
 * An unset TABULA_REGION stays US so existing deploys keep booting.
 * Any other unrecognized value fails closed: TEFCA and Fasten stay off
 * and the server refuses to start.
 *
 * Fasten Connect is the US patient-mediated retrieval path. It does not
 * depend on TEFCA. TEFCA is a separate US network switch.
 * World turns both off. A world chart still needs a regional store
 * before it is offered in a country. See the consolidation plan.
 */

export const DEPLOYMENT_REGIONS = ["us", "world"] as const;
export type DeploymentRegion = (typeof DEPLOYMENT_REGIONS)[number];

export interface DeploymentEnv {
  TABULA_REGION?: string;
  TEFCA_ENABLED?: string;
  FASTEN_ENABLED?: string;
}

export interface DeploymentConfig {
  /** Null when TABULA_REGION is set to a value this build does not know. */
  region: DeploymentRegion | null;
  accepted: boolean;
  tefcaEnabled: boolean;
  fastenEnabled: boolean;
}

export function parseDeploymentRegion(raw: string | undefined | null): DeploymentRegion | null {
  if (raw == null || raw.trim() === "") return "us";
  const value = raw.trim().toLowerCase();
  if (value === "us" || value === "usa" || value === "united-states") return "us";
  if (value === "world" || value === "international" || value === "intl") return "world";
  return null;
}

export function resolveDeployment(env: DeploymentEnv): DeploymentConfig {
  const region = parseDeploymentRegion(env.TABULA_REGION);
  if (region == null) {
    return { region: null, accepted: false, tefcaEnabled: false, fastenEnabled: false };
  }
  if (region === "world") {
    return { region, accepted: true, tefcaEnabled: false, fastenEnabled: false };
  }
  return {
    region,
    accepted: true,
    tefcaEnabled: env.TEFCA_ENABLED !== "false",
    fastenEnabled: env.FASTEN_ENABLED !== "false",
  };
}
