/**
 * Shareable record links (server/mobile-api-routes.ts /api/share-links).
 * Backs the Emergency / break-glass "share my record" action and the
 * settings share-management list.
 */
import { api } from "./client";
import type { CreateShareLinkInput, ShareLink } from "./types";

export async function listShareLinks(): Promise<ShareLink[]> {
  const res = await api.get<{ links: ShareLink[] }>("/api/share-links");
  return res.links;
}

export async function createShareLink(
  input: CreateShareLinkInput = {}
): Promise<{ id: string; url: string; accessCode?: string; expiresAt: string }> {
  return api.post("/api/share-links", {
    expiresInHours: input.expiresInHours ?? 24,
    includeConditions: input.includeConditions ?? true,
    includeMedications: input.includeMedications ?? true,
    includeLabResults: input.includeLabResults ?? true,
  });
}

export async function revokeShareLink(id: string): Promise<void> {
  await api.delete(`/api/share-links/${id}`);
}
