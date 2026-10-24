export interface DeviceConsent {
  integrationId: string;
  scopes: readonly string[];
  grantedAt: string;
  revokedAt?: string;
}

export function consentIsActive(consent: DeviceConsent, atIso: string, scope: string): boolean {
  if (consent.revokedAt && consent.revokedAt <= atIso) return false;
  if (consent.grantedAt > atIso) return false;
  return consent.scopes.includes(scope);
}
