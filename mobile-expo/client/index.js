import { registerRootComponent } from "expo";
import { LogBox, Platform } from "react-native";

function reportErrorToServer(type, message, details) {
  try {
    const domain = typeof process !== "undefined" && process.env && process.env.EXPO_PUBLIC_DOMAIN;
    const base = domain ? `${window.location.protocol}//${domain}` : "";
    fetch(`${base}/api/client-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, message, details, timestamp: new Date().toISOString() }),
    }).catch(() => {});
  } catch (e) {}
}

if (Platform.OS === "web" && typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    console.log("[GLOBAL_ERROR]", event.message, event.filename, event.lineno);
    reportErrorToServer("global_error", event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    console.log("[UNHANDLED_REJECTION]", event.reason?.message || event.reason);
    reportErrorToServer("unhandled_rejection", event.reason?.message || String(event.reason), {
      stack: event.reason?.stack,
    });
  });
}

import App from "@/App";

registerRootComponent(App);
