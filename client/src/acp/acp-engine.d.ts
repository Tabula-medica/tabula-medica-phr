/**
 * Ambient types for the portable ACP engine (dependency-free .mjs shared verbatim with the
 * Tabula EHR plugin and World EHR). Loose `any` signatures — the single source of truth for
 * behavior is the .mjs + the Python engine's tests. See client/src/acp/*.mjs.
 */
declare module "@/acp/stateRules.mjs" {
  export function knownStates(): Array<{ code: string; name: string; statutory_form_exists: boolean; counsel_verified: boolean }>;
  export function meta(): any;
  export function forState(code?: string | null): any;
  export function executionRequirements(code?: string | null): any;
  export function witnessDisqualifications(code: string | null | undefined, roles: string[]): string[];
  export function signingPlan(code: string | null | undefined, witnesses?: any[], notarized?: boolean): any;
}
declare module "@/acp/directive.mjs" {
  export const CODE_STATUS: string[];
  export const TREATMENT_KEYS: string[];
  export const TREATMENT_LABELS: Record<string, string>;
  export function normalize(payload: any): any;
  export function missingRecommended(doc: any): string[];
  export function contentHash(doc: any): Promise<string>;
  export function toSections(doc: any, rules: any): Array<{ heading: string; lines: string[] }>;
}
declare module "@/acp/billing.mjs" {
  export const ACP_FEES: Record<string, number>;
  export function capture(payload: any): any;
}
declare module "@/acp/renderHtml.mjs" {
  export function renderDirectiveHtml(doc: any, rules: any, opts?: { variant?: "signable" | "unsigned_provider"; contentHash?: string }): string;
}
