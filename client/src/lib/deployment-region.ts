import { parseDeploymentRegion, type DeploymentRegion } from "@shared/deployment-region";

/** Build-time hint. Unknown values fail closed. The server response is authoritative. */
export function buildTimeRegion(): DeploymentRegion | "invalid" {
  const raw = import.meta.env.VITE_TABULA_REGION;
  if (typeof raw !== "string" || raw.trim() === "") return "us";
  return parseDeploymentRegion(raw) ?? "invalid";
}
