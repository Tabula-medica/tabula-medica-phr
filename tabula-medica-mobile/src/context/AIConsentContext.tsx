import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import * as SecureStore from "expo-secure-store";

const CONSENT_KEY = "tabula_ai_consent_v2";

export interface ConsentFlags {
  ambient: boolean;
  clinicalAI: boolean;
  thirdPartySharing: boolean;
}

interface AIConsentContextType {
  hasConsented: boolean;
  isLoading: boolean;
  consentTimestamp: string | null;
  promptConsent: () => void;
  grantConsent: () => Promise<void>;
  revokeConsent: () => Promise<void>;
  isPrompting: boolean;
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

async function recordConsentServerSide(flags: ConsentFlags, action: "grant" | "revoke" | "update"): Promise<void> {
  try {
    await fetch("/api/users/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flags, action, timestamp: new Date().toISOString() }),
    });
  } catch {
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
        const stored = await readConsent();
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

  const grantConsent = useCallback(async () => {
    const allGranted: ConsentFlags = { ambient: true, clinicalAI: true, thirdPartySharing: false };
    const ts = await writeConsent(allGranted);
    await recordConsentServerSide(allGranted, "grant");
    setFlags(allGranted);
    setConsentTimestamp(ts);
    setIsPrompting(false);
  }, []);

  const revokeConsent = useCallback(async () => {
    const allRevoked: ConsentFlags = { ambient: false, clinicalAI: false, thirdPartySharing: false };
    await writeConsent(allRevoked);
    await recordConsentServerSide(allRevoked, "revoke");
    setFlags(allRevoked);
    setConsentTimestamp(null);
  }, []);

  const grantFeatureConsent = useCallback(async (feature: keyof ConsentFlags) => {
    const updated = { ...flags, [feature]: true };
    const ts = await writeConsent(updated);
    await recordConsentServerSide(updated, "update");
    setFlags(updated);
    setConsentTimestamp(ts);
  }, [flags]);

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
