/**
 * expo-cac-reader — TypeScript API
 *
 * The complete JavaScript-facing interface for the CAC/PIV native module.
 * React Native components import from here — never from the native layer directly.
 *
 * Quick start:
 *   const { isCardPresent, certificate, signChallenge } = useCACReader();
 *
 * Full auth flow:
 *   1. startWatching() — begin listening for card insertion
 *   2. onCardInserted event fires
 *   3. readAuthCertificate() — read X.509 cert from slot 9A
 *   4. Send certDerBase64 to server → server returns a challenge
 *   5. verifyPin(userPin) — unlock card for signing
 *   6. signChallenge(challengeHex) — card signs the challenge
 *   7. Send signatureBase64 to server → server verifies → session established
 */

import { NativeModule, requireNativeModule, EventEmitter } from 'expo-modules-core';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform, AppState } from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CACCertificate {
  /** Base64-encoded DER certificate — send to server for chain validation */
  certDerBase64: string;
  /** Full X.500 distinguished name — e.g. "CN=SMITH.JOHN.1234567890, OU=DoD, O=U.S. Government" */
  subject: string;
  /** Certificate issuer — e.g. "CN=DoD CA-59, OU=PKI, OU=DoD, O=U.S. Government, C=US" */
  issuer: string;
  serialNumber: string;
  /** ISO 8601 — certificate validity start */
  notBefore: string;
  /** ISO 8601 — certificate validity end */
  notAfter: string;
  /** 10-digit DoD ID number — primary identifier for DoD personnel */
  edipi: string;
  /** .mil email address from Subject Alternative Name extension */
  email: string;
  /** "ECDSA-P384" | "RSA-2048" — algorithm used for signing operations */
  keyAlgorithm: 'ECDSA-P384' | 'RSA-2048';
  /** PIV slot — always "9A" for authentication */
  slot: string;
}

export interface CACSignResult {
  /** Base64-encoded signature — send to server for verification */
  signatureBase64: string;
  signatureHex: string;
  algorithm: 'ECDSA-P384' | 'RSA-2048';
  slot: string;
}

export interface CACCardInfo {
  /** Federal Agency Smart Credential Number (FASC-N) — hex encoded */
  fascN?: string;
  /** Card GUID — hex encoded */
  cardGuid?: string;
  /** Card expiration date */
  expirationDate?: string;
}

export interface CACReaderInfo {
  name: string;
  hasCard: boolean;
  state?: number;
}

export interface CACAvailabilityResult {
  readers: CACReaderInfo[];
  tokens: string[];
  supportsSmartCard: boolean;
  nfcAvailable?: boolean;
  nfcEnabled?: boolean;
  cardPresent?: boolean;
}

export interface PinVerifyResult {
  success: boolean;
  retriesRemaining: number;
}

export interface CardInsertedEvent {
  tokenId: string;
  readerName: string;
  tagId?: string;
}

export interface CardRemovedEvent {
  tokenId: string;
}

// ─── Native module binding ────────────────────────────────────────────────────

let _nativeModule: any = null;

function getNativeModule() {
  if (_nativeModule) return _nativeModule;
  try {
    _nativeModule = requireNativeModule('ExpoCacReader');
    return _nativeModule;
  } catch {
    return null;
  }
}

function isAvailable(): boolean {
  return getNativeModule() !== null;
}

// ─── Module API ───────────────────────────────────────────────────────────────

/**
 * Begin watching for card insertion/removal events.
 * Must be called before any other operations.
 * On Android, this enables NFC reader mode.
 */
export async function startWatching(): Promise<boolean> {
  const mod = getNativeModule();
  if (!mod) throw new Error('[CAC] Native module not available — rebuild with EAS');
  return mod.startWatching();
}

export async function stopWatching(): Promise<boolean> {
  return getNativeModule()?.stopWatching() ?? false;
}

/**
 * List available card readers.
 * iOS: TKSmartCardSlotManager slots + TKTokenWatcher tokens
 * Android: NFC adapter state + USB reader detection
 */
export async function getAvailableReaders(): Promise<CACAvailabilityResult> {
  const mod = getNativeModule();
  if (!mod) return { readers: [], tokens: [], supportsSmartCard: false };
  return mod.getAvailableReaders();
}

/**
 * Read the PIV authentication certificate from slot 9A.
 * This is the certificate used for DoD identity authentication.
 * Does NOT require PIN.
 *
 * @param tokenId Optional — specific reader/token ID. Uses first available if omitted.
 */
export async function readAuthCertificate(tokenId?: string): Promise<CACCertificate> {
  const mod = getNativeModule();
  if (!mod) throw new Error('[CAC] Native module not available');
  return mod.readAuthCertificate(tokenId ?? null);
}

/**
 * Verify the card PIN.
 * Required before signing operations.
 * WARNING: Cards typically block after 3 wrong attempts.
 *
 * @returns { success, retriesRemaining }
 */
export async function verifyPin(pin: string): Promise<PinVerifyResult> {
  const mod = getNativeModule();
  if (!mod) throw new Error('[CAC] Native module not available');
  return mod.verifyPin(pin);
}

/**
 * Sign a challenge using the card's slot 9A private key.
 * The private key NEVER leaves the card.
 * PIN must be verified first with verifyPin().
 *
 * @param challengeHex 32 bytes as hex (64 chars) — from server /api/auth/cac/challenge
 */
export async function signChallenge(challengeHex: string): Promise<CACSignResult> {
  const mod = getNativeModule();
  if (!mod) throw new Error('[CAC] Native module not available');
  return mod.signChallenge(challengeHex);
}

/**
 * Get card holder info (CHUID) — FASC-N, card GUID, expiration.
 */
export async function getCardInfo(): Promise<CACCardInfo> {
  const mod = getNativeModule();
  if (!mod) throw new Error('[CAC] Native module not available');
  return mod.getCardInfo();
}

export async function disconnect(): Promise<boolean> {
  return getNativeModule()?.disconnect() ?? true;
}

// ─── Event emitter ────────────────────────────────────────────────────────────

function getEmitter(): EventEmitter | null {
  const mod = getNativeModule();
  if (!mod) return null;
  try {
    return new EventEmitter(mod as NativeModule<any>);
  } catch {
    return null;
  }
}

export function addCardInsertedListener(
  callback: (event: CardInsertedEvent) => void
): () => void {
  const emitter = getEmitter();
  if (!emitter) return () => {};
  const sub = emitter.addListener('onCardInserted', callback);
  return () => sub.remove();
}

export function addCardRemovedListener(
  callback: (event: CardRemovedEvent) => void
): () => void {
  const emitter = getEmitter();
  if (!emitter) return () => {};
  const sub = emitter.addListener('onCardRemoved', callback);
  return () => sub.remove();
}

// ─── React hook ───────────────────────────────────────────────────────────────

export type CACAuthStep =
  | 'idle'
  | 'waiting_for_card'
  | 'card_detected'
  | 'reading_cert'
  | 'waiting_for_pin'
  | 'verifying_pin'
  | 'signing'
  | 'authenticated'
  | 'error';

export interface UseCACReaderResult {
  /** Whether the native module is available (requires custom dev client) */
  isModuleAvailable: boolean;
  /** Whether a CAC card is currently detected */
  isCardPresent: boolean;
  /** Certificate read from slot 9A */
  certificate: CACCertificate | null;
  /** Current step in the auth flow */
  step: CACAuthStep;
  /** Error message if step === 'error' */
  error: string | null;
  /** PIN retries remaining (shown after wrong PIN) */
  pinRetriesRemaining: number | null;
  /** Start the auth flow */
  startAuth: () => void;
  /** Submit PIN */
  submitPin: (pin: string, challenge: string) => Promise<CACSignResult | null>;
  /** Reset to idle */
  reset: () => void;
}

/**
 * useCACReader — complete CAC authentication flow as a React hook.
 *
 * Usage:
 *   const cac = useCACReader();
 *
 *   // In your UI:
 *   if (!cac.isModuleAvailable) return <SoftwareCertFallback />;
 *   if (cac.step === 'waiting_for_card') return <HoldCardInstructions />;
 *   if (cac.step === 'waiting_for_pin') return <PinEntryScreen onSubmit={cac.submitPin} />;
 *   if (cac.step === 'authenticated') return <AuthSuccess edipi={cac.certificate?.edipi} />;
 */
export function useCACReader(): UseCACReaderResult {
  const [isCardPresent, setIsCardPresent] = useState(false);
  const [certificate, setCertificate] = useState<CACCertificate | null>(null);
  const [step, setStep] = useState<CACAuthStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pinRetriesRemaining, setPinRetriesRemaining] = useState<number | null>(null);
  const isWatching = useRef(false);

  const moduleAvailable = isAvailable();

  useEffect(() => {
    if (!moduleAvailable) return;

    const removeInserted = addCardInsertedListener(async (event) => {
      setIsCardPresent(true);
      setStep('reading_cert');
      setError(null);

      try {
        const cert = await readAuthCertificate(event.tokenId);
        setCertificate(cert);
        setStep('waiting_for_pin');
      } catch (err: any) {
        setError(err.message ?? 'Failed to read certificate');
        setStep('error');
      }
    });

    const removeRemoved = addCardRemovedListener(() => {
      setIsCardPresent(false);
      setCertificate(null);
      if (step !== 'authenticated') {
        setStep('waiting_for_card');
      }
    });

    // Pause NFC when app backgrounds (save battery, comply with DISA policy)
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'background' && isWatching.current) {
        stopWatching().catch(() => {});
        isWatching.current = false;
      }
    });

    return () => {
      removeInserted();
      removeRemoved();
      appStateSub.remove();
    };
  }, [moduleAvailable, step]);

  const startAuth = useCallback(() => {
    if (!moduleAvailable) return;
    setStep('waiting_for_card');
    setError(null);
    setCertificate(null);
    startWatching()
      .then(() => { isWatching.current = true; })
      .catch((err) => {
        setError(err.message ?? 'Failed to start reader');
        setStep('error');
      });
  }, [moduleAvailable]);

  const submitPin = useCallback(async (
    pin: string,
    challengeHex: string
  ): Promise<CACSignResult | null> => {
    if (!isCardPresent) {
      setError('Card not present');
      setStep('error');
      return null;
    }

    setStep('verifying_pin');
    setError(null);

    try {
      const pinResult = await verifyPin(pin);

      if (!pinResult.success) {
        setPinRetriesRemaining(pinResult.retriesRemaining);
        setError(`Wrong PIN. ${pinResult.retriesRemaining} attempt${pinResult.retriesRemaining !== 1 ? 's' : ''} remaining.`);
        setStep('waiting_for_pin');
        return null;
      }

      setPinRetriesRemaining(null);
      setStep('signing');

      const sigResult = await signChallenge(challengeHex);
      setStep('authenticated');
      return sigResult;
    } catch (err: any) {
      const message = err.message ?? 'Authentication failed';
      const isPinBlocked = message.includes('blocked') || err.code === 'PIN_BLOCKED';

      setError(isPinBlocked
        ? 'Card PIN is blocked. Contact your CAC issuer.'
        : message
      );
      setStep('error');
      return null;
    }
  }, [isCardPresent]);

  const reset = useCallback(() => {
    setStep('idle');
    setError(null);
    setCertificate(null);
    setIsCardPresent(false);
    setPinRetriesRemaining(null);
    stopWatching().catch(() => {});
    isWatching.current = false;
  }, []);

  return {
    isModuleAvailable: moduleAvailable,
    isCardPresent,
    certificate,
    step,
    error,
    pinRetriesRemaining,
    startAuth,
    submitPin,
    reset,
  };
}

export { isAvailable as isCACReaderAvailable };
