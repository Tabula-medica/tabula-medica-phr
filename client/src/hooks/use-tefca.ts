import { useQuery } from "@tanstack/react-query";
import type { DeploymentRegion } from "@shared/deployment-region";

interface PublicConfig {
  tefcaEnabled: boolean;
  fastenEnabled?: boolean;
  region?: DeploymentRegion;
}

/**
 * Runtime flags. TEFCA and Fasten are separate. World turns both off.
 * Fasten stays available on a US deploy that has TEFCA disabled.
 * Until the response loads, both default on so a US first paint is not blank.
 * World hides them once config arrives.
 */
export function usePublicConfig(): { tefcaEnabled: boolean; fastenEnabled: boolean; region: DeploymentRegion } {
  const { data } = useQuery<PublicConfig>({
    queryKey: ["/api/public-config"],
    staleTime: Infinity,
  });
  return {
    tefcaEnabled: data?.tefcaEnabled ?? true,
    fastenEnabled: data?.fastenEnabled ?? data?.tefcaEnabled ?? true,
    region: data?.region ?? "us",
  };
}

export function useTefcaEnabled(): boolean {
  return usePublicConfig().tefcaEnabled;
}

export function useFastenEnabled(): boolean {
  return usePublicConfig().fastenEnabled;
}
