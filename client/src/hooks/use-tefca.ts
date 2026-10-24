import { useQuery } from "@tanstack/react-query";
import type { DeploymentRegion } from "@shared/deployment-region";

interface PublicConfig {
  tefcaEnabled: boolean;
  region?: DeploymentRegion;
}

/**
 * Runtime feature flag for the TEFCA / Fasten Health external-records
 * connectivity. The international `tabulamedica.world` deployment runs the
 * SAME image as `.us` but with `TEFCA_ENABLED=false`, so the client must read
 * the flag at runtime (the bundle is built once and shared by both services).
 *
 * Defaults to `true` until `/api/public-config` resolves so the US experience
 * is never briefly degraded; `.world` shows the TEFCA surface for a moment on
 * first paint, then hides it once config loads.
 */
export function usePublicConfig(): { tefcaEnabled: boolean; region: DeploymentRegion } {
  const { data } = useQuery<PublicConfig>({
    queryKey: ["/api/public-config"],
    staleTime: Infinity,
  });
  return {
    tefcaEnabled: data?.tefcaEnabled ?? true,
    region: data?.region ?? "us",
  };
}

export function useTefcaEnabled(): boolean {
  return usePublicConfig().tefcaEnabled;
}
