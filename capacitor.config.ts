import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tabulamedica.app",
  appName: "Tabula Medica",
  webDir: "dist/public",
  bundledWebRuntime: false,

  server: {
    androidScheme: "https",
    iosScheme: "https",
    cleartext: false,
  },

  ios: {
    contentInset: "automatic",
    backgroundColor: "#1a3a52",
    limitsNavigationsToAppBoundDomains: true,
    allowsLinkPreview: false,
  },

  android: {
    backgroundColor: "#1a3a52",
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#1a3a52",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      overlaysWebView: false,
      style: "DARK",
      backgroundColor: "#1a3a52",
    },
    Keyboard: {
      resize: "body",
      style: "DARK",
      resizeOnFullScreen: true,
    },
    Preferences: {
      group: "TabulaMedicaPreferences",
    },
    Camera: {
      promptLabelHeader: "Add medical document",
      promptLabelPhoto: "Choose from library",
      promptLabelPicture: "Take photo",
    },
  },
};

export default config;
