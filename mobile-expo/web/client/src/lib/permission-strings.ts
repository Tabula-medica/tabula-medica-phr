export const PERMISSION_STRINGS = {
  healthShare:
    "Tabula Medica reads your Health data to bring it together with your other records in one place you control. Nothing is shared without your explicit consent.",
  healthUpdate:
    "Tabula Medica writes vitals you log here back to Apple Health so your other apps stay in sync.",
  microphone:
    'Tabula Medica records doctor visits when you tap the record button so you can refer back to your visit later. Recording starts only when you tap and stops when you tap stop. Recordings are encrypted on your device and uploaded only after you tap "Save".',
  camera:
    "Tabula Medica uses the camera to scan insurance cards and upload medical documents.",
  photoLibrary:
    "Tabula Medica accesses your photo library so you can upload medical documents and insurance cards.",
  faceId: "Tabula Medica uses Face ID to unlock your encrypted health record.",
  locationWhenInUse:
    "Tabula Medica uses your location to find nearby doctors, FQHCs, and community health resources.",
} as const;

export type PermissionKey = keyof typeof PERMISSION_STRINGS;

export const PRE_PROMPT_FLAG_KEY = (k: PermissionKey) =>
  `pre-prompt-shown:${k}:v1`;

export function hasSeenPrePrompt(k: PermissionKey): boolean {
  try {
    return localStorage.getItem(PRE_PROMPT_FLAG_KEY(k)) === "1";
  } catch {
    return false;
  }
}

export function markPrePromptSeen(k: PermissionKey): void {
  try {
    localStorage.setItem(PRE_PROMPT_FLAG_KEY(k), "1");
  } catch {}
}

export function logPermissionTelemetry(
  permission: PermissionKey,
  outcome: "shown" | "accepted" | "declined" | "dismissed",
): void {
  const event = {
    permission,
    outcome,
    timestamp: new Date().toISOString(),
    platform:
      typeof window !== "undefined" &&
      (window as any).Capacitor?.isNativePlatform?.()
        ? (window as any).Capacitor.getPlatform()
        : "web",
  };
  try {
    const k = "permission-telemetry-v1";
    const existing = JSON.parse(localStorage.getItem(k) || "[]");
    existing.push(event);
    localStorage.setItem(k, JSON.stringify(existing.slice(-100)));
  } catch {}
  try {
    fetch("/api/telemetry/permission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}
