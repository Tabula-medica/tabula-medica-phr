export const isNative = false;
export const platform = "web";
export const isIOS = false;
export const isAndroid = false;
export const isWeb = true;

export async function initCapacitor() {}

export async function hapticFeedback(
  _style: "light" | "medium" | "heavy" = "light",
) {}

export async function openExternalUrl(url: string) {
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener");
  }
}

export async function shareContent(opts: {
  title: string;
  text: string;
  url?: string;
}) {
  if (typeof navigator !== "undefined" && (navigator as any).share) {
    try {
      await (navigator as any).share(opts);
    } catch {}
  }
}

export async function setPreference(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export async function getPreference(key: string): Promise<string | null> {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function removePreference(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}
