# expo-cac-reader

Native CAC/PIV smart card authentication for Expo (React Native).

## What it does

Enables hardware Common Access Card (CAC) and Personal Identity Verification (PIV)
authentication for DoD and federal government personnel.

| Platform | Technology | Assurance Level |
|----------|-----------|----------------|
| iOS      | CryptoTokenKit (TKSmartCard) | IAL3 (hardware) |
| Android  | NFC IsoDep (ISO 7816-4) | IAL3 (hardware) |
| Fallback | ECDSA P-384 in Secure Enclave | IAL2 (software) |

## Supported hardware

- **ACR3901T-W1** — Bluetooth CAC reader (most common DoD-issued reader)
- **Identiv SCR3500A** — USB-C reader for iOS 15+ / iPad
- **HID Omnikey 3021** — USB reader for tablets
- Any PC/SC or ISO 14443-4 compliant contactless reader

## Installation

Already included as a local module. No npm install needed.

Requires a **custom EAS build** — does not work in Expo Go.

```sh
eas build --profile development --platform ios
eas build --profile development --platform android
```

## Usage

```tsx
import { useCACReader } from './modules/expo-cac-reader/src';

function CACLoginScreen() {
  const cac = useCACReader();

  if (!cac.isModuleAvailable) {
    return <SoftwareCertFallback />;
  }

  return (
    <View>
      {cac.step === 'idle' && (
        <Button title="Authenticate with CAC" onPress={cac.startAuth} />
      )}
      {cac.step === 'waiting_for_card' && (
        <Text>Hold your CAC card to the reader...</Text>
      )}
      {cac.step === 'waiting_for_pin' && (
        <PinEntry
          onSubmit={(pin) => cac.submitPin(pin, serverChallenge)}
          retriesRemaining={cac.pinRetriesRemaining}
        />
      )}
      {cac.step === 'authenticated' && (
        <Text>Welcome, EDIPI: {cac.certificate?.edipi}</Text>
      )}
    </View>
  );
}
```

## Auth flow

```
App                          Card                        Server
 |                             |                           |
 |--- startWatching() -------->|                           |
 |<-- onCardInserted event ----|                           |
 |--- readAuthCertificate() -->|                           |
 |<-- X.509 cert (slot 9A) ----|                           |
 |--- POST /api/auth/cac/challenge ----------------------->|
 |<-- challengeHex (32 bytes) ----------------------------|
 |--- verifyPin(userPin) ----->|                           |
 |<-- PIN OK ------------------|                           |
 |--- signChallenge(hex) ----->|                           |
 |                    [card signs internally]              |
 |<-- signature (ECDSA P-384) -|                           |
 |--- POST /api/auth/cac/verify (cert + sig) ------------->|
 |                              [server verifies chain]    |
 |<-- CACAuthSession (EDIPI, assuranceLevel: IAL3) --------|
```

## iOS entitlements required

Add to your `.entitlements` file (the config plugin does this automatically):

```xml
<key>com.apple.security.smartcard</key>
<true/>
```

## DISA STIGs addressed

- `AIOS-13-010300` — DoD PKI authentication required
- `AIOS-13-010400` — Certificate-based authentication for PHI access
- `GMAP-11-002100` — Hardware-backed authentication for sensitive data
