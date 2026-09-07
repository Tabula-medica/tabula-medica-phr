// ABDM-only fetch. ABDM hosts geo-fence to India, so when ABDM_HTTPS_PROXY is set, route ABDM calls
// through that proxy (undici ProxyAgent); otherwise a normal fetch. ONLY ABDM traffic uses this.
import { ProxyAgent } from "undici";
import { abdmConfig } from "./config";

let agent: ProxyAgent | null = null;
function proxyAgent(): ProxyAgent | null {
  if (!abdmConfig.httpsProxy) return null;
  if (!agent) agent = new ProxyAgent(abdmConfig.httpsProxy);
  return agent;
}
export function _resetAbdmProxyAgent(): void {
  agent = null;
}
export async function abdmFetch(url: string, init?: RequestInit): Promise<Response> {
  const a = proxyAgent();
  return a ? fetch(url, { ...init, dispatcher: a } as RequestInit & { dispatcher: unknown }) : fetch(url, init);
}
