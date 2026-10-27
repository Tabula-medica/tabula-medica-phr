import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// USER profile (email, fullName, appleUserId) is PII — stored in Keychain/
// Keystore via SecureStore so it cannot be read from the plaintext file
// that backs AsyncStorage on unencrypted Android devices.
// SETTINGS (biometric toggle, notifications) are non-sensitive and remain in
// AsyncStorage.  Health records and data sources are PHI_STORAGE_DISABLED
// (server-side only) so their keys are kept as no-ops.
const STORAGE_KEYS = {
  USER: "tabula_medica_user",           // SecureStore key
  HEALTH_RECORDS: "@tabula_medica_records", // AsyncStorage, PHI_STORAGE_DISABLED
  DATA_SOURCES: "@tabula_medica_sources",   // AsyncStorage, PHI_STORAGE_DISABLED
  SETTINGS: "@tabula_medica_settings",      // AsyncStorage, non-sensitive
};

// SecureStore helpers — gracefully degrade on web (server-enforced auth there).
const secureGet = async (key: string): Promise<string | null> => {
  if (Platform.OS === "web") return null;
  try { return await SecureStore.getItemAsync(key); } catch { return null; }
};
const secureSet = async (key: string, value: string): Promise<void> => {
  if (Platform.OS === "web") return;
  await SecureStore.setItemAsync(key, value);
};
const secureDelete = async (key: string): Promise<void> => {
  if (Platform.OS === "web") return;
  try { await SecureStore.deleteItemAsync(key); } catch { /* key absent */ }
};

const PHI_STORAGE_DISABLED = true;

export interface User {
  id: string;
  email: string;
  fullName: string;
  appleUserId?: string;
  createdAt: string;
}

export type RecordType = "visit" | "lab" | "medication" | "imaging" | "procedure" | "immunization" | "allergy" | "vital";

export interface HealthRecord {
  id: string;
  type: RecordType;
  title: string;
  date: string;
  provider: string;
  sourceId: string;
  summary: string;
  details?: Record<string, string>;
  attachments?: string[];
  lastSynced: string;
}

export type DataSourceType = "hospital" | "clinic" | "pharmacy" | "lab" | "insurance" | "tefca";

export interface DataSource {
  id: string;
  name: string;
  type: DataSourceType;
  fhirEndpoint?: string;
  connected: boolean;
  lastSync?: string;
  recordCount: number;
  tefcaNetworkId?: string;
}

export interface AppSettings {
  biometricEnabled: boolean;
  notificationsEnabled: boolean;
  autoSyncEnabled: boolean;
}

export const storage = {
  async getUser(): Promise<User | null> {
    try {
      const data = await secureGet(STORAGE_KEYS.USER);
      if (data) return JSON.parse(data);
      // Legacy migration: check AsyncStorage once and promote to SecureStore.
      const legacy = await AsyncStorage.getItem("@tabula_medica_user");
      if (legacy) {
        await secureSet(STORAGE_KEYS.USER, legacy);
        await AsyncStorage.removeItem("@tabula_medica_user");
        return JSON.parse(legacy);
      }
      return null;
    } catch {
      return null;
    }
  },

  async setUser(user: User): Promise<void> {
    await secureSet(STORAGE_KEYS.USER, JSON.stringify(user));
  },

  async removeUser(): Promise<void> {
    await secureDelete(STORAGE_KEYS.USER);
    // Also clear legacy AsyncStorage slot on sign-out.
    await AsyncStorage.removeItem("@tabula_medica_user");
  },

  async getHealthRecords(): Promise<HealthRecord[]> {
    if (PHI_STORAGE_DISABLED) {
      return [];
    }
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.HEALTH_RECORDS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async setHealthRecords(_records: HealthRecord[]): Promise<void> {
    if (PHI_STORAGE_DISABLED) {
      return;
    }
  },

  async addHealthRecord(_record: HealthRecord): Promise<void> {
    if (PHI_STORAGE_DISABLED) {
      return;
    }
  },

  async getDataSources(): Promise<DataSource[]> {
    if (PHI_STORAGE_DISABLED) {
      return [];
    }
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.DATA_SOURCES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async setDataSources(_sources: DataSource[]): Promise<void> {
    if (PHI_STORAGE_DISABLED) {
      return;
    }
  },

  async addDataSource(_source: DataSource): Promise<void> {
    if (PHI_STORAGE_DISABLED) {
      return;
    }
  },

  async removeDataSource(_sourceId: string): Promise<void> {
    if (PHI_STORAGE_DISABLED) {
      return;
    }
  },

  async getSettings(): Promise<AppSettings> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : {
        biometricEnabled: false,
        notificationsEnabled: true,
        autoSyncEnabled: true,
      };
    } catch {
      return {
        biometricEnabled: false,
        notificationsEnabled: true,
        autoSyncEnabled: true,
      };
    }
  },

  async setSettings(settings: AppSettings): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  async clearAll(): Promise<void> {
    await secureDelete(STORAGE_KEYS.USER);
    await AsyncStorage.multiRemove([
      "@tabula_medica_user", // legacy slot
      STORAGE_KEYS.HEALTH_RECORDS,
      STORAGE_KEYS.DATA_SOURCES,
      STORAGE_KEYS.SETTINGS,
    ]);
  },
};

export function generateMockRecords(): HealthRecord[] {
  const now = new Date();
  return [
    {
      id: "1",
      type: "visit",
      title: "Annual Physical Exam",
      date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      provider: "Dr. Sarah Johnson",
      sourceId: "source-1",
      summary: "Routine annual checkup. All vitals normal.",
      details: {
        "Blood Pressure": "120/80 mmHg",
        "Heart Rate": "72 bpm",
        "Weight": "165 lbs",
        "Height": "5'10\"",
      },
      lastSynced: now.toISOString(),
    },
    {
      id: "2",
      type: "lab",
      title: "Complete Blood Count",
      date: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      provider: "Quest Diagnostics",
      sourceId: "source-2",
      summary: "All values within normal range.",
      details: {
        "WBC": "7.2 x10^9/L",
        "RBC": "4.8 x10^12/L",
        "Hemoglobin": "14.5 g/dL",
        "Platelets": "250 x10^9/L",
      },
      lastSynced: now.toISOString(),
    },
    {
      id: "3",
      type: "medication",
      title: "Lisinopril 10mg",
      date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      provider: "CVS Pharmacy",
      sourceId: "source-3",
      summary: "Blood pressure medication - take once daily.",
      details: {
        "Dosage": "10mg",
        "Frequency": "Once daily",
        "Refills": "3 remaining",
        "Prescriber": "Dr. Sarah Johnson",
      },
      lastSynced: now.toISOString(),
    },
    {
      id: "4",
      type: "imaging",
      title: "Chest X-Ray",
      date: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      provider: "City Medical Center",
      sourceId: "source-1",
      summary: "No abnormalities detected. Heart and lungs appear normal.",
      details: {
        "Findings": "Clear lung fields",
        "Heart Size": "Normal",
        "Impression": "No acute cardiopulmonary disease",
      },
      lastSynced: now.toISOString(),
    },
    {
      id: "5",
      type: "immunization",
      title: "Influenza Vaccine",
      date: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      provider: "Walgreens",
      sourceId: "source-4",
      summary: "2024-2025 seasonal flu vaccine administered.",
      details: {
        "Vaccine Type": "Quadrivalent",
        "Lot Number": "FL2024-789",
        "Route": "Intramuscular",
        "Site": "Left deltoid",
      },
      lastSynced: now.toISOString(),
    },
  ];
}

export function generateMockSources(): DataSource[] {
  return [
    {
      id: "source-1",
      name: "City Medical Center",
      type: "hospital",
      fhirEndpoint: "https://fhir.citymedical.org/r4",
      connected: true,
      lastSync: new Date().toISOString(),
      recordCount: 24,
    },
    {
      id: "source-2",
      name: "Quest Diagnostics",
      type: "lab",
      fhirEndpoint: "https://fhir.questdiagnostics.com/r4",
      connected: true,
      lastSync: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      recordCount: 15,
    },
  ];
}
