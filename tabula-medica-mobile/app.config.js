export default {
  expo: {
    name: "Tabula Medica",
    slug: "tabula-medica-mobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: false,
    scheme: "com.tabulamedica.app",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0F766E"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.tabulamedica.app",
      // Required by `expo-apple-authentication` so the native build enables
      // the Sign in with Apple capability and the JS hook reports ready.
      usesAppleSignIn: true,
      infoPlist: {
        NSFaceIDUsageDescription: "Use Face ID to securely access your health records",
        NSCameraUsageDescription: "Scan documents and medical records",
        ITSAppUsesNonExemptEncryption: false
      }
    },
    plugins: ["expo-apple-authentication"],
    android: {
      package: "com.tabulamedica.app",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#0F766E"
      },
      edgeToEdgeEnabled: true,
      permissions: ["USE_BIOMETRIC", "USE_FINGERPRINT", "CAMERA"],
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "com.tabulamedica.app",
              host: "auth",
              pathPrefix: "/callback"
            }
          ],
          category: ["BROWSABLE", "DEFAULT"]
        }
      ]
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      apiBaseUrl: process.env.API_BASE_URL || "https://www.tabulamedica.digital",
      // Firebase / GCIP — mirrors the web client's VITE_GCIP_* config so
      // mobile-issued Firebase ID tokens are accepted by the backend's
      // server/auth/gcip.ts verifier without any server changes.
      gcipApiKey: process.env.EXPO_PUBLIC_GCIP_API_KEY,
      gcipAuthDomain: process.env.EXPO_PUBLIC_GCIP_AUTH_DOMAIN,
      gcipProjectId: process.env.EXPO_PUBLIC_GCIP_PROJECT_ID,
      // Google sign-in (mirrors web's GoogleAuthProvider flow). Get the
      // per-platform OAuth client IDs from the Firebase/GCP console and
      // expose them as EXPO_PUBLIC_GOOGLE_*_CLIENT_ID for the build.
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      fhirRedirectScheme: process.env.FHIR_REDIRECT_SCHEME || "com.tabulamedica.app",
      fhirClientId: process.env.FHIR_CLIENT_ID || "tabula-medica",
      fhirAuthUrl: process.env.FHIR_AUTH_URL,
      fhirTokenUrl: process.env.FHIR_TOKEN_URL
    }
  }
};
