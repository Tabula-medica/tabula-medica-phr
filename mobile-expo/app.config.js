/**
 * Dynamic Expo config.
 *
 * Purpose: populate `expo.extra.*` runtime config deterministically for the WEB
 * export, replacing the fragile manual app.json placeholder substitution that
 * kept dropping EXPO_PUBLIC_* values between builds. Expo reads `app.json` as the
 * static base and passes it to this function as `config`; we spread it through
 * unchanged and only fill in the `extra` runtime values.
 *
 * GCIP / Firebase key split (web key must NEVER reach a native binary):
 *   The committed WEB defaults below (the HTTP-referrer Firebase browser key)
 *   are applied ONLY when an explicit web-export opt-in flag is set:
 *
 *       TABULA_WEB_EXPORT=1   (and NOT an EAS build)
 *
 *   This fails CLOSED for every native context. `expo run:ios`, `expo prebuild`,
 *   local native packaging, EAS builds, and OTA/update pipelines never set the
 *   flag, so they never receive the web key — they resolve GCIP config from
 *   `process.env` (eas.json `env` = the native key) and fall back to the
 *   app.json `$EXPO_PUBLIC_*` placeholders (which the client treats as "unset").
 *   We do NOT infer "web" by the absence of EAS_BUILD; platform is not knowable
 *   in dynamic config, so we require a positive, web-only signal instead.
 *
 *   The WEB defaults are PUBLIC values — they ship in every browser bundle —
 *   not secrets. `process.env` always wins when set, so explicit per-build
 *   overrides still work.
 *
 * The canonical web export command sets the flag, e.g.:
 *   TABULA_WEB_EXPORT=1 EXPO_PUBLIC_API_URL=... npx expo export --platform web
 */
const IS_EAS_BUILD = process.env.EAS_BUILD === "true";
const IS_WEB_EXPORT = process.env.TABULA_WEB_EXPORT === "1" && !IS_EAS_BUILD;

// PUBLIC web runtime config — safe to commit (these are shipped to the browser).
const WEB_DEFAULTS = IS_WEB_EXPORT
  ? {
      gcipApiKey: "",
      gcipAuthDomain: "united-planet-485003-n7.firebaseapp.com",
      gcipProjectId: "united-planet-485003-n7",
      googleIosClientId:
        "1060107259776-kj22i9ssb5e88i7pfi16mmnqc2ktaa3v.apps.googleusercontent.com",
      apiBaseUrl: "https://api.tabulamedica.health",
    }
  : {};

// Precedence: explicit env var > committed web default > existing app.json value.
// A value that still looks like an unsubstituted "$EXPO_PUBLIC_*" placeholder is
// treated as unset (the client's cleanExtraValue() does the same).
function resolve(envVal, webDefault, existing) {
  if (typeof envVal === "string" && envVal.trim() && !envVal.startsWith("$")) {
    return envVal;
  }
  if (webDefault) return webDefault;
  return existing;
}

module.exports = ({ config }) => {
  const extra = config.extra || {};
  return {
    ...config,
    extra: {
      ...extra,
      gcipApiKey: resolve(
        process.env.EXPO_PUBLIC_GCIP_API_KEY,
        WEB_DEFAULTS.gcipApiKey,
        extra.gcipApiKey,
      ),
      gcipAuthDomain: resolve(
        process.env.EXPO_PUBLIC_GCIP_AUTH_DOMAIN,
        WEB_DEFAULTS.gcipAuthDomain,
        extra.gcipAuthDomain,
      ),
      gcipProjectId: resolve(
        process.env.EXPO_PUBLIC_GCIP_PROJECT_ID,
        WEB_DEFAULTS.gcipProjectId,
        extra.gcipProjectId,
      ),
      googleIosClientId: resolve(
        process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
        WEB_DEFAULTS.googleIosClientId,
        extra.googleIosClientId,
      ),
      googleAndroidClientId: resolve(
        process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
        undefined,
        extra.googleAndroidClientId,
      ),
      apiBaseUrl: resolve(
        process.env.EXPO_PUBLIC_API_URL,
        WEB_DEFAULTS.apiBaseUrl,
        extra.apiBaseUrl,
      ),
    },
  };
};
