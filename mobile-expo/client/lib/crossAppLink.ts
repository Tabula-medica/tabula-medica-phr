import { Linking } from "react-native";
import { apiRequest, getApiUrl } from "@/lib/query-client";

interface DeepLinkOptions {
  cptCode: string;
  specialty: string;
}

export async function deepLinkToUninsurance(opts: DeepLinkOptions): Promise<void> {
  try {
    const response = await apiRequest("POST", "/api/cross-app/token", {
      cptCode: opts.cptCode,
      specialty: opts.specialty,
    });

    const { xtoken } = await response.json();
    const deepLink = `https://uninsurance.care/book?xtoken=${encodeURIComponent(xtoken)}`;
    await Linking.openURL(deepLink);
  } catch {
    const fallbackUrl = `https://uninsurance.care/book?cpt=${encodeURIComponent(opts.cptCode)}&specialty=${encodeURIComponent(opts.specialty)}&source=tabula_medica`;
    await Linking.openURL(fallbackUrl).catch(() => {});
  }
}
