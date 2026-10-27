# iOS Export Compliance — Tabula Medica Mobile

**Status:** Exempt under US BIS Category 5D992(c) — uses only iOS-provided
encryption.

**Technical declaration:** `ios.config.usesNonExemptEncryption: false` in
`app.json`. This compiles to `<key>ITSAppUsesNonExemptEncryption</key><false/>`
in the generated `Info.plist` during EAS Build / Expo prebuild.

**App Store Connect answer:** "App uses only encryption that is part of the
underlying iOS operating system" — exemption applies, no Export Compliance
Code needed, no annual self-classification report required.

## Justification

The mobile app uses only:

- HTTPS / TLS (system-provided URLSession / fetch)
- `expo-secure-store` → iOS Keychain (system-provided)
- Apple Sign In via `expo-apple-authentication` (system-provided OAuth/OIDC)
- Biometric authentication via `expo-local-authentication` (system Face ID /
  Touch ID)
- Standard JWT verification via the API server (server-side, no app-side
  custom crypto)

**No custom ciphers, no end-to-end encryption, no key generation in app, no
export of cryptographic functionality to other software, no VPN
functionality.**

## Single source of truth

The configuration lives **only** in `app.json` under `expo.ios.config`:

```json
"ios": {
  "config": {
    "usesNonExemptEncryption": false
  }
}
```

There must **not** be a duplicate `ITSAppUsesNonExemptEncryption` key under
`ios.infoPlist`. Expo generates the correct Info.plist key automatically from
`ios.config.usesNonExemptEncryption`. Adding it to `infoPlist` as well creates
a drift risk where one is changed without the other and Apple's `altool`
upload validation rejects the build with "Invalid Export Compliance Code"
(see History below).

## Re-evaluate this declaration if the app adds:

- End-to-end encryption (e.g., patient-to-doctor encrypted messaging,
  encrypted PHR exports with app-managed keys)
- Custom encryption algorithms or key management beyond Keychain
- VPN-style functionality or proxy / tunneling
- Third-party crypto libraries beyond standard OAuth / JWT / HTTPS
- Cryptographic functionality exposed for use by other apps

If any of the above are added, change `usesNonExemptEncryption` to `true`,
file the BIS annual self-classification report, and obtain an Export
Compliance Code (`ITSEncryptionExportComplianceCode`) before next submission.

## History

- **2026-04-28:** Builds 1.0.0 (66) and 1.0.0 (67) failed App Store Connect
  upload silently. EAS submissions `fb3ab151`, `927bf73f`, `065d7d7f` all
  errored at the Fastlane Pilot / `altool` step with:
  > Validation failed Invalid Export Compliance Code. The export compliance
  > key value `[]` in the app's Info.plist doesn't match the key value of the
  > app's export compliance.

  Root cause: `app.json` had a contradiction — `ios.config.usesNonExemptEncryption: false`
  AND `ios.infoPlist.ITSAppUsesNonExemptEncryption: true`. The `infoPlist`
  override won and Apple expected a matching exemption code in the binary
  that wasn't there.

- **2026-04-29:** Build 1.0.0 (68) shipped with `ITSAppUsesNonExemptEncryption`
  set explicitly to `false` in `infoPlist`. Submission `85425040` finished
  cleanly with no error — Apple accepted the upload.

- **2026-04-29 (later same day):** Cleaned up `app.json` to remove the
  explicit `infoPlist.ITSAppUsesNonExemptEncryption` entry entirely, leaving
  `ios.config.usesNonExemptEncryption: false` as the single source of truth.
  Effective from the next build forward.
