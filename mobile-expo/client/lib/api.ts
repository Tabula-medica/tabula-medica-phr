import axios, { AxiosInstance } from "axios";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { validateDomain, enforceHttps } from "@/lib/security";

const ACCESS_TOKEN_KEY = "tabula_medica_access_token";
const REFRESH_TOKEN_KEY = "tabula_medica_refresh_token";
const USER_ID_KEY = "@tabula_medica_user_id";

async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function setSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function deleteSecureItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

export async function getAccessToken(): Promise<string | null> {
  return getSecureItem(ACCESS_TOKEN_KEY);
}

export async function setAccessToken(token: string): Promise<void> {
  await setSecureItem(ACCESS_TOKEN_KEY, token);
}

export async function getRefreshToken(): Promise<string | null> {
  return getSecureItem(REFRESH_TOKEN_KEY);
}

export async function setRefreshToken(token: string): Promise<void> {
  await setSecureItem(REFRESH_TOKEN_KEY, token);
}

export async function clearTokens(): Promise<void> {
  await deleteSecureItem(ACCESS_TOKEN_KEY);
  await deleteSecureItem(REFRESH_TOKEN_KEY);
}

export async function getUserId(): Promise<string | null> {
  return AsyncStorage.getItem(USER_ID_KEY);
}

export async function setUserId(userId: string): Promise<void> {
  await AsyncStorage.setItem(USER_ID_KEY, userId);
}

export async function clearUserId(): Promise<void> {
  await AsyncStorage.removeItem(USER_ID_KEY);
}

function getBaseURL(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const hostname = window.location.hostname;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return "http://localhost:5000";
    }
    
    // Replit dev/preview: Express backend (port 5000) is mapped to external
    // port 80 in .replit, so the browser reaches it on the same origin
    // (no port suffix). Adding ":5000" here would try an unexposed port and
    // fail with "A network error occurred" → app stuck on launch.
    if (hostname.includes('replit.dev') || hostname.includes('repl.co')) {
      return `${window.location.protocol}//${window.location.host}`;
    }

    if (hostname.includes('replit.app') || hostname.includes('run.app')) {
      return `${window.location.protocol}//${window.location.host}`;
    }
    
    return `${window.location.protocol}//${window.location.host}`;
  }

  if (process.env.EXPO_PUBLIC_DOMAIN) {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    if (domain.includes(':')) {
      return `https://${domain}`;
    }
    return `https://${domain}`;
  }
  
  if (Constants.expoConfig?.extra?.apiBaseUrl) {
    return Constants.expoConfig.extra.apiBaseUrl;
  }
  
  return "https://api.tabulamedica.health";
}

const baseURL = getBaseURL();
console.log("[API] Final baseURL:", baseURL);

export const axiosInstance: AxiosInstance = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

async function retryRequest<T>(fn: () => Promise<T>, maxRetries = 2, delayMs = 1500): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRetryable = error.code === "ECONNABORTED" ||
        error.code === "ERR_NETWORK" ||
        error.message?.includes("timeout") ||
        error.message?.includes("Network Error") ||
        (error.response?.status && error.response.status >= 500);
      if (!isRetryable || attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  throw lastError;
}

async function warmUpServer(): Promise<void> {
  try {
    await axios.get(`${baseURL}/api/health`, { timeout: 5000 }).catch(() => {
      return axios.get(`${baseURL}/`, { timeout: 5000 });
    });
  } catch {}
}

axiosInstance.interceptors.request.use(async (config) => {
  const requestUrl = config.baseURL
    ? `${config.baseURL}${config.url || ""}`
    : config.url || "";

  if (requestUrl && !validateDomain(requestUrl)) {
    return Promise.reject(
      new Error(`[Security] Request blocked: untrusted domain in URL "${requestUrl}"`)
    );
  }

  if (requestUrl) {
    const secured = enforceHttps(requestUrl);
    if (secured !== requestUrl && config.baseURL) {
      config.baseURL = enforceHttps(config.baseURL);
    }
  }

  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const userId = await getUserId();
  if (userId) {
    config.headers["x-user-id"] = userId;
  }

  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || "";
      const isAuthEndpoint = url.includes("/api/auth/") || url.includes("/api/users/");
      if (isAuthEndpoint) {
        await clearTokens();
        await clearUserId();
      }
    }

    if (error.response?.status === 403) {
      const data = error.response?.data;
      if (data && typeof data === "object" && data.code === "FEATURE_GATED" && typeof data.feature === "string") {
        try {
          const { emitServerFeatureGate } = await import("./feature-gate-events");
          emitServerFeatureGate({
            feature: data.feature,
            currentTier: data.currentTier,
            requiredTier: data.requiredTier,
            upgradeMessage: data.upgradeMessage,
          });
        } catch (emitErr) {
          console.warn("[API] Failed to emit feature gate event:", emitErr);
        }
      }
    }

    return Promise.reject(error);
  }
);

export interface User {
  id: string;
  email: string;
  name: string;
  appleId?: string | null;
  avatarUrl?: string | null;
  isDemo: boolean;
  biometricEnabled: boolean;
  autoSyncEnabled: boolean;
  notificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HealthRecord {
  id: string;
  userId: string;
  type: string;
  title: string;
  summary: string | null;
  date: string;
  provider: string | null;
  facility: string | null;
  details: Record<string, any> | null;
  sourceId: string | null;
  fhirResourceType: string | null;
  fhirResourceId: string | null;
  isManual: boolean;
  importedAt: string;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecordAttachment {
  id: string;
  recordId: string;
  userId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  thumbnailPath: string | null;
  uploadedAt: string;
}

export interface DataSource {
  id: string;
  userId: string;
  name: string;
  type: string;
  fhirEndpoint: string | null;
  isConnected: boolean;
  lastSyncAt: string | null;
  recordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShareLink {
  id: string;
  userId: string;
  token: string;
  passcode: string | null;
  expiresAt: string;
  isRevoked: boolean;
  recordIds: string[] | null;
  categories: string[] | null;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  createdAt: string;
  shareUrl?: string;
}

export interface Packet {
  id: string;
  userId: string;
  shareLinkId: string | null;
  title: string;
  pdfUrl: string | null;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  categories: string[] | null;
  recordCount: number;
  createdAt: string;
}

export const api = {
  auth: {
    async register(payload: {
      email: string;
      password: string;
      name: string;
    }): Promise<{ user: User }> {
      await warmUpServer();
      const response = await axiosInstance.post<{ user: User; accessToken?: string; refreshToken?: string; error?: string }>("/api/auth/register", payload);
      if (!response.data?.user?.id) {
        throw new Error(response.data?.error || "Registration failed - invalid server response");
      }
      const data = response.data;
      await setUserId(data.user.id);
      if (data.accessToken) await setAccessToken(data.accessToken);
      if (data.refreshToken) await setRefreshToken(data.refreshToken);
      return data;
    },

    async login(payload: {
      email: string;
      password: string;
    }): Promise<{ user: User }> {
      await warmUpServer();
      const data = await retryRequest(async () => {
        const response = await axiosInstance.post<{ user: User; accessToken?: string; refreshToken?: string; error?: string }>("/api/auth/login", payload);
        if (!response.data?.user?.id) {
          throw new Error(response.data?.error || "Login failed - invalid server response");
        }
        return response.data;
      }, 1);
      await setUserId(data.user.id);
      if (data.accessToken) await setAccessToken(data.accessToken);
      if (data.refreshToken) await setRefreshToken(data.refreshToken);
      return data;
    },

    async apple(payload: {
      appleId: string;
      email?: string;
      fullName?: string;
      identityToken?: string;
    }): Promise<{ user: User; accessToken?: string; refreshToken?: string }> {
      await warmUpServer();
      const data = await retryRequest(async () => {
        const response = await axiosInstance.post<{ user: User; accessToken?: string; refreshToken?: string; error?: string }>("/api/auth/apple", payload);
        if (!response.data?.user?.id) {
          throw new Error(response.data?.error || "Apple sign-in failed - invalid server response");
        }
        return response.data;
      }, 1);
      await setUserId(data.user.id);
      if (data.accessToken) await setAccessToken(data.accessToken);
      if (data.refreshToken) await setRefreshToken(data.refreshToken);
      return data;
    },

    // Task #71 — `api.auth.auth0` was removed when Auth0 user login was
    // retired. The mobile client now uses `api.auth.gcip` exclusively for
    // federated identity. Old builds calling `POST /api/auth/auth0` will
    // receive HTTP 410 with code `auth0_user_login_retired`.

    // Task #68 — exchange a verified GCIP/Firebase ID token for one of our
    // opaque session tokens. Server side resolves to an existing internal
    // user via external_identities (auto-linking on verified email) or
    // provisions a fresh user.
    async gcip(payload: {
      idToken: string;
    }): Promise<{ user: User; accessToken?: string; refreshToken?: string }> {
      await warmUpServer();
      const data = await retryRequest(async () => {
        const response = await axiosInstance.post<{ user: User; accessToken?: string; refreshToken?: string }>("/api/auth/gcip", payload);
        if (!response.data?.user?.id) {
          throw new Error("GCIP sign-in failed - invalid server response");
        }
        return response.data;
      }, 1);
      await setUserId(data.user.id);
      if (data.accessToken) await setAccessToken(data.accessToken);
      if (data.refreshToken) await setRefreshToken(data.refreshToken);
      return data;
    },

    async logout(): Promise<void> {
      await clearTokens();
      await clearUserId();
    },
  },

  users: {
    async get(id: string): Promise<User> {
      const { data } = await axiosInstance.get<User>(`/api/users/${id}`);
      return data;
    },

    async update(id: string, payload: Partial<User>): Promise<User> {
      const { data } = await axiosInstance.patch<User>(`/api/users/${id}`, payload);
      return data;
    },

    async delete(id: string): Promise<void> {
      await axiosInstance.delete(`/api/users/${id}`);
      await clearTokens();
      await clearUserId();
    },
  },

  records: {
    async list(filters?: {
      type?: string;
      provider?: string;
      dateFrom?: string;
      dateTo?: string;
      sortBy?: "date" | "provider";
      sortOrder?: "asc" | "desc";
    }): Promise<HealthRecord[]> {
      const params: Record<string, string> = {};
      if (filters?.type) params.type = filters.type;
      if (filters?.provider) params.provider = filters.provider;
      if (filters?.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters?.dateTo) params.dateTo = filters.dateTo;
      if (filters?.sortBy) params.sortBy = filters.sortBy;
      if (filters?.sortOrder) params.sortOrder = filters.sortOrder;
      const { data } = await axiosInstance.get<HealthRecord[]>("/api/records", { params });
      return data;
    },

    async get(id: string): Promise<HealthRecord> {
      const { data } = await axiosInstance.get<HealthRecord>(`/api/records/${id}`);
      return data;
    },

    async create(payload: Partial<HealthRecord>): Promise<HealthRecord> {
      const { data } = await axiosInstance.post<HealthRecord>("/api/records", payload);
      return data;
    },

    async update(id: string, payload: Partial<HealthRecord>): Promise<HealthRecord> {
      const { data } = await axiosInstance.patch<HealthRecord>(`/api/records/${id}`, payload);
      return data;
    },

    async delete(id: string): Promise<void> {
      await axiosInstance.delete(`/api/records/${id}`);
    },

    async getProviders(): Promise<string[]> {
      const { data } = await axiosInstance.get<string[]>("/api/records/providers");
      return data;
    },

    async getAttachments(recordId: string): Promise<RecordAttachment[]> {
      const { data } = await axiosInstance.get<RecordAttachment[]>(`/api/records/${recordId}/attachments`);
      return data;
    },

    async uploadAttachment(recordId: string, fileUri: string, fileName: string): Promise<RecordAttachment> {
      const { File } = await import("expo-file-system");
      const formData = new FormData();
      const file = new File(fileUri);
      formData.append("file", file as any);
      const { data } = await axiosInstance.post<RecordAttachment>(
        `/api/records/${recordId}/attachments`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return data;
    },

    async deleteAttachment(recordId: string, attachmentId: string): Promise<void> {
      await axiosInstance.delete(`/api/records/${recordId}/attachments/${attachmentId}`);
    },
  },

  sources: {
    async list(): Promise<DataSource[]> {
      const { data } = await axiosInstance.get<DataSource[]>("/api/sources");
      return data;
    },

    async get(id: string): Promise<DataSource> {
      const { data } = await axiosInstance.get<DataSource>(`/api/sources/${id}`);
      return data;
    },

    async create(payload: Partial<DataSource>): Promise<DataSource> {
      const { data } = await axiosInstance.post<DataSource>("/api/sources", payload);
      return data;
    },

    async delete(id: string): Promise<void> {
      await axiosInstance.delete(`/api/sources/${id}`);
    },

    async sync(id: string): Promise<void> {
      await axiosInstance.post(`/api/sources/${id}/sync`);
    },
  },

  shareLinks: {
    async list(): Promise<ShareLink[]> {
      const { data } = await axiosInstance.get<ShareLink[]>("/api/share-links");
      return data;
    },

    async create(payload: {
      expiresInHours?: number;
      passcode?: string;
      recordIds?: string[];
      categories?: string[];
      dateRangeStart?: string;
      dateRangeEnd?: string;
    }): Promise<ShareLink> {
      const { data } = await axiosInstance.post<ShareLink>("/api/share-links", payload);
      return data;
    },

    async revoke(id: string): Promise<void> {
      await axiosInstance.post(`/api/share-links/${id}/revoke`);
    },

    async getShared(token: string, passcode?: string): Promise<{
      expiresAt: string;
      records: HealthRecord[];
    }> {
      const params = passcode ? { passcode } : {};
      const { data } = await axiosInstance.get(`/api/share/${token}`, { params });
      return data;
    },
  },

  packets: {
    async list(): Promise<Packet[]> {
      const { data } = await axiosInstance.get<Packet[]>("/api/packets");
      return data;
    },

    async create(payload: {
      title: string;
      categories?: string[];
      dateRangeStart?: string;
      dateRangeEnd?: string;
      shareLinkId?: string;
    }): Promise<Packet> {
      const { data } = await axiosInstance.post<Packet>("/api/packets", payload);
      return data;
    },
  },

  export: {
    getPdfUrl(): string {
      return `${baseURL}/api/export/pdf`;
    },
  },

  tefca: {
    async getNetworks(): Promise<{
      networks: TefcaNetwork[];
      isConfigured: boolean;
    }> {
      const { data } = await axiosInstance.get("/api/tefca/networks");
      return data;
    },

    async queryPatient(payload: {
      patient: TefcaPatientQuery;
      networkIds?: string[];
      exchangePurpose?: string;
    }): Promise<{
      results: TefcaQueryResult[];
      totalRecords: number;
      networksQueried: number;
    }> {
      const { data } = await axiosInstance.post("/api/tefca/query", payload);
      return data;
    },

    async importRecords(payload: {
      queryResults: TefcaQueryResult;
      networkName?: string;
    }): Promise<{
      source: DataSource;
      importedCount: number;
      records: HealthRecord[];
    }> {
      const { data } = await axiosInstance.post("/api/tefca/import", payload);
      return data;
    },
  },

  healthSummary: {
    async get(): Promise<HealthSummary> {
      const { data } = await axiosInstance.get<HealthSummary>("/api/health-summary");
      return data;
    },
  },
};

export interface HealthSummary {
  greeting: string;
  overallStatus: string;
  statusDescription: string;
  keyInsights: Array<{
    category: 'vitals' | 'medications' | 'conditions' | 'appointments' | 'immunizations' | 'general';
    icon: string;
    title: string;
    value: string;
    trend?: 'up' | 'down' | 'stable';
    trendDescription?: string;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    date: string;
    description: string;
  }>;
  upcomingItems: Array<{
    id: string;
    type: string;
    title: string;
    date: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  aiSummary: string;
  recommendations: string[];
}

export interface TefcaNetwork {
  id: string;
  name: string;
  type: "qhin" | "participant";
  description: string;
  supportedExchangePurposes: string[];
}

export interface TefcaPatientQuery {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  zipCode?: string;
  gender?: "male" | "female" | "other";
}

export interface TefcaQueryResult {
  networkId: string;
  networkName: string;
  records: TefcaRecord[];
  queryId: string;
  timestamp: string;
}

export interface TefcaRecord {
  resourceType: string;
  resourceId: string;
  title: string;
  date: string;
  provider?: string;
  facility?: string;
  summary?: string;
  details?: Record<string, unknown>;
  rawFhir?: unknown;
}
