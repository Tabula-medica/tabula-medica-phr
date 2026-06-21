import axios from "axios";
import Constants from "expo-constants";
import { getGcipIdToken, isGcipConfigured } from "../lib/gcip";

export const api = axios.create({
  baseURL: Constants.expoConfig?.extra?.apiBaseUrl,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

async function getAccessToken(): Promise<string | null> {
  if (!isGcipConfigured()) return null;
  try {
    return await getGcipIdToken();
  } catch {
    return null;
  }
}

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, force a token refresh and retry once before giving up. This keeps
// short-lived 401s (e.g. clock skew, expiry races) from kicking the user out.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original?._retried && isGcipConfigured()) {
      original._retried = true;
      try {
        const fresh = await getGcipIdToken(true);
        if (fresh) {
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${fresh}`;
          return api.request(original);
        }
      } catch {
        // fall through to reject
      }
    }
    return Promise.reject(error);
  }
);

export async function getAuthToken(): Promise<string | null> {
  return getAccessToken();
}

export default api;
