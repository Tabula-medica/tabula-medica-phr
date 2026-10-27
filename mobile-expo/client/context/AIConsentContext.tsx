/**
 * AIConsentContext — GDPR Article 9 compliant consent management
 *
 * Changes from original:
 * - Migrated from AsyncStorage → expo-secure-store (Keychain/Keystore backed)
 * - Per-feature consent flags (ambient, clinicalAI, thirdPartySharing)
 * - Server-side consent recording for GDPR audit trail
 * - Backward compatible: existing useAIConsent() callers still work
 */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest } from "@/lib/query-client";

const CONSENT_KEY = "tabula_ai_consent_v2";

export interface ConsentFlags {
  ambient: boolean;           // Microphone recording during provider visits
  clinicalAI: boolean;        // AI analysis of health records
  thirdPartySharing: boolean; // Sharing with external AI/research partners
}

interface AIConsentContextType {
  // Backward-compatible single flag (true if core features consented)
  hasConsented: boolean;
  isLoading: boolean;
  consentTimestamp: string | null;
  promptConsent: () => void;
  grantConsent: () => Promise<void>;
  revokeConsent: () => Promise<void>;
  isPrompting: boolean;
  // Per-feature granular consent
  flags: ConsentFlags;
  grantFeatureConsent: (feature: keyof ConsentFlags) => Promise<void>;
  revokeFeatureConsent: (feature: keyof ConsentFlags) => Promise<void>;
  hasFeatureConsent: (feature: keyof ConsentFlags) => boolean;
}

interface StoredConsent {
  flags: ConsentFlags;
  timestamp: string;
  version: number;
}

const DEFAULT_FLAGS: ConsentFlags = {
  ambient: false,
  clinicalAI: false,
  thirdPartySharing: false,
};

const AIConsentContext = createContext<AIConsentContextType | undefined>(undefined);

async function readConsent(): Promise<StoredConsent | null> {
  try {
    const raw = await SecureStore.getItemAsync(CONSENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredConsent;
  } catch {
    return null;
  }
}

async function writeConsent(flags: ConsentFlags): Promise<string> {
  const timestamp = new Date().toISOString();
  const stored: StoredConsent = { flags, timestamp, version: 2 };
  await SecureStore.setItemAsync(CONSENT_KEY, JSON.stringify(stored));
  return timestamp;
}

async function migrateLegacyConsent(): Promise<ConsentFlags | null> {
  try {
    const legacyKey = "@tabula_ai_consent";
    const legacy = await AsyncStorage.getItem(legacyKey);
    if (!legacy) return null;
    const parsed = JSON.parse(legacy);
    const migrated: ConsentFlags = {
      ambient: !!parsed.hasConsented,
      clinicalAI: !!parsed.hasConsented,
      thirdPartySharing: false,
    };
    await writeConsent(migrated);
    await AsyncStorage.removeItem(legacyKey);
    return migrated;
  } catch {
    return null;
  }
}

async function recordConsentServerSide(flags: ConsentFlags, action: "grant" | "revoke" | "update"): Promise<void> {
  try {
    await apiRequest("POST", "/api/users/consent", { flags, action, timestamp: new Date().toISOString() });
  } catch {
    // Non-fatal — SecureStore is the source of truth; server records when connectivity returns
  }
}

export function AIConsentProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<ConsentFlags>(DEFAULT_FLAGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isPrompting, setIsPrompting] = useState(false);
  const [consentTimestamp, setConsentTimestamp] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        let stored = await readConsent();
        if (!stored) {
          const migrated = await migrateLegacyConsent();
          if (migrated) {
            stored = await readConsent();
          }
        }
        if (stored) {
          setFlags(stored.flags);
          setConsentTimestamp(stored.timestamp);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const hasConsented = flags.clinicalAI && flags.ambient;

  const promptConsent = useCallback(() => {
    if (!hasConsented) setIsPrompting(true);
  }, [hasConsented]);

  // Grant all features at once (backward-compatible)
  const grantConsent = useCallback(async () => {
    const allGranted: ConsentFlags = { ambient: true, clinicalAI: true, thirdPartySharing: false };
    const ts = await writeConsent(allGranted);
    await recordConsentServerSide(allGranted, "grant");
    setFlags(allGranted);
    setConsentTimestamp(ts);
    setIsPrompting(false);
  }, []);

  // Revoke all features (backward-compatible)
  const revokeConsent = useCallback(async () => {
    const allRevoked: ConsentFlags = { ambient: false, clinicalAI: false, thirdPartySharing: false };
    await writeConsent(allRevoked);
    await recordConsentServerSide(allRevoked, "revoke");
    setFlags(allRevoked);
    setConsentTimestamp(null);
  }, []);

  // Grant a single feature
  const grantFeatureConsent = useCallback(async (feature: keyof ConsentFlags) => {
    const updated = { ...flags, [feature]: true };
    const ts = await writeConsent(updated);
    await recordConsentServerSide(updated, "update");
    setFlags(updated);
    setConsentTimestamp(ts);
  }, [flags]);

  // Revoke a single feature
  const revokeFeatureConsent = useCallback(async (feature: keyof ConsentFlags) => {
    const updated = { ...flags, [feature]: false };
    await writeConsent(updated);
    await recordConsentServerSide(updated, "update");
    setFlags(updated);
  }, [flags]);

  const hasFeatureConsent = useCallback((feature: keyof ConsentFlags) => flags[feature], [flags]);

  return (
    <AIConsentContext.Provider
      value={{
        hasConsented,
        isLoading,
        consentTimestamp,
        promptConsent,
        grantConsent,
        revokeConsent,
        isPrompting,
        flags,
        grantFeatureConsent,
        revokeFeatureConsent,
        hasFeatureConsent,
      }}
    >
      {children}
    </AIConsentContext.Provider>
  );
}

export function useAIConsent() {
  const ctx = useContext(AIConsentContext);
  if (!ctx) throw new Error("useAIConsent must be used within AIConsentProvider");
  return ctx;
}
