/**
 * Expo Config Plugin for expo-cac-reader
 *
 * Automatically injects required iOS entitlements, Info.plist keys,
 * and Android manifest permissions at build time via EAS.
 *
 * Users add to app.json:
 *   "plugins": ["./modules/expo-cac-reader"]
 *
 * This replaces having to manually edit native files.
 */

const { withInfoPlist, withEntitlementsPlist, withAndroidManifest } = require('@expo/config-plugins');

// ─── iOS modifications ────────────────────────────────────────────────────────

function withCACIosEntitlements(config) {
  return withEntitlementsPlist(config, (mod) => {
    const entitlements = mod.modResults;

    // Smart card entitlement — required for CryptoTokenKit TKSmartCard
    // Without this, the app can't communicate with hardware card readers
    entitlements['com.apple.security.smartcard'] = true;

    return mod;
  });
}

function withCACIosInfoPlist(config) {
  return withInfoPlist(config, (mod) => {
    const plist = mod.modResults;

    // NFC usage description (for iPhone NFC card reading)
    if (!plist['NFCReaderUsageDescription']) {
      plist['NFCReaderUsageDescription'] =
        'Tabula Medica reads your DoD CAC card via NFC for secure identity verification.';
    }

    // Smart card token extension — allows the app to work with CryptoTokenKit tokens
    // This declares the app as a consumer of smart card tokens
    if (!plist['com.apple.token']) {
      plist['com.apple.token'] = ['com.apple.setoken'];
    }

    return mod;
  });
}

// ─── Android modifications ────────────────────────────────────────────────────

function withCACAndroidManifest(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults;
    const mainApplication = manifest.manifest.application?.[0];
    if (!mainApplication) return mod;

    // Ensure uses-permission for NFC is present
    const permissions = manifest.manifest['uses-permission'] || [];
    const hasNFC = permissions.some(
      p => p.$?.['android:name'] === 'android.permission.NFC'
    );

    if (!hasNFC) {
      manifest.manifest['uses-permission'] = [
        ...permissions,
        { $: { 'android:name': 'android.permission.NFC' } },
      ];
    }

    // NFC feature declaration (preferred, not required — allows install on non-NFC devices)
    const features = manifest.manifest['uses-feature'] || [];
    const hasNFCFeature = features.some(
      f => f.$?.['android:name'] === 'android.hardware.nfc'
    );

    if (!hasNFCFeature) {
      manifest.manifest['uses-feature'] = [
        ...features,
        {
          $: {
            'android:name': 'android.hardware.nfc',
            'android:required': 'false',  // false = NFC preferred but app works without it
          },
        },
      ];
    }

    return mod;
  });
}

// ─── Plugin entry point ───────────────────────────────────────────────────────

function withExpoCacReader(config, options = {}) {
  config = withCACIosEntitlements(config);
  config = withCACIosInfoPlist(config);
  config = withCACAndroidManifest(config);
  return config;
}

module.exports = withExpoCacReader;
