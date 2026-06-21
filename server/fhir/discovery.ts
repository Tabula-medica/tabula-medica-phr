export interface SmartConfiguration {
  authorization_endpoint: string;
  token_endpoint: string;
  token_endpoint_auth_methods_supported?: string[];
  registration_endpoint?: string;
  scopes_supported?: string[];
  response_types_supported?: string[];
  capabilities?: string[];
  code_challenge_methods_supported?: string[];
  introspection_endpoint?: string;
  revocation_endpoint?: string;
  management_endpoint?: string;
}

const discoveryCache = new Map<string, { config: SmartConfiguration; expiresAt: number }>();
const CACHE_TTL = 3600_000;

export async function discoverSmartConfiguration(
  fhirBaseUrl: string
): Promise<SmartConfiguration | null> {
  const cached = discoveryCache.get(fhirBaseUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.config;
  }

  const baseUrl = fhirBaseUrl.replace(/\/+$/, "");
  const discoveryUrl = `${baseUrl}/.well-known/smart-configuration`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(discoveryUrl, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`[SMART-Discovery] No SMART config at ${discoveryUrl} (${response.status})`);
      return null;
    }

    const config: SmartConfiguration = await response.json();
    discoveryCache.set(fhirBaseUrl, { config, expiresAt: Date.now() + CACHE_TTL });
    console.log(`[SMART-Discovery] Discovered endpoints for ${fhirBaseUrl}`);
    return config;
  } catch (err: any) {
    console.log(`[SMART-Discovery] Failed for ${fhirBaseUrl}: ${err.message}`);
    return null;
  }
}

export function clearDiscoveryCache(): void {
  discoveryCache.clear();
}

export async function resolveAuthEndpoints(
  fhirBaseUrl: string,
  fallbackAuthEndpoint: string,
  fallbackTokenEndpoint: string
): Promise<{ authorizationEndpoint: string; tokenEndpoint: string; supportsPkce: boolean }> {
  const smartConfig = await discoverSmartConfiguration(fhirBaseUrl);

  if (smartConfig) {
    return {
      authorizationEndpoint: smartConfig.authorization_endpoint || fallbackAuthEndpoint,
      tokenEndpoint: smartConfig.token_endpoint || fallbackTokenEndpoint,
      supportsPkce: smartConfig.code_challenge_methods_supported?.includes("S256") ?? true,
    };
  }

  return {
    authorizationEndpoint: fallbackAuthEndpoint,
    tokenEndpoint: fallbackTokenEndpoint,
    supportsPkce: true,
  };
}
