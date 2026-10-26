import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  analyticsPageUrl,
  mayLoadThirdPartyAnalytics,
} from "../shared/privacy/analytics-allowlist";
import {
  assertPhiSpeechEngine,
  BROWSER_SPEECH_RECOGNITION_APIS,
  localSynthesisAllowed,
  preferSpeechEngine,
} from "../shared/voice/policy";
import {
  acceptGcpTranscript,
  encodingForMime,
  gcpSpeechFlagEnabled,
  parsePhiAudioBody,
  parsePhiSpeakBody,
} from "../server/services/phi-speech";

const root = path.resolve(__dirname, "..");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|js|jsx|html|css)$/.test(entry)) out.push(full);
  }
  return out;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

const HEALTH_PATHS = [
  "/conditions",
  "/medications",
  "/timeline",
  "/womens-health",
  "/care-gaps",
  "/advance-directives",
  "/symptom-checker",
  "/drug-interactions",
  "/intake",
  "/auth/login",
  "/consent",
  "/settings",
  "/patient/chart",
];

describe("third-party analytics allowlist", () => {
  it("allows only logged-out marketing pages on production hosts", () => {
    expect(mayLoadThirdPartyAnalytics({
      pathname: "/",
      authenticated: false,
      hostname: "tabulamedica.health",
    })).toBe(true);
    expect(mayLoadThirdPartyAnalytics({
      pathname: "/pricing",
      authenticated: false,
      hostname: "www.tabulamedica.us",
    })).toBe(true);
  });

  it("refuses health, account, and authenticated routes", () => {
    for (const pathname of HEALTH_PATHS) {
      expect(mayLoadThirdPartyAnalytics({
        pathname,
        authenticated: false,
        hostname: "tabulamedica.health",
      }), pathname).toBe(false);
    }
    expect(mayLoadThirdPartyAnalytics({
      pathname: "/",
      authenticated: true,
      hostname: "tabulamedica.health",
    })).toBe(false);
    expect(mayLoadThirdPartyAnalytics({
      pathname: "/pricing",
      authenticated: true,
      hostname: "tabulamedica.health",
    })).toBe(false);
  });

  it("refuses preview hosts and strips the query string from the reported URL", () => {
    expect(mayLoadThirdPartyAnalytics({
      pathname: "/",
      authenticated: false,
      hostname: "localhost",
    })).toBe(false);
    expect(mayLoadThirdPartyAnalytics({
      pathname: "/",
      authenticated: false,
      hostname: "abc.replit.dev",
    })).toBe(false);
    expect(analyticsPageUrl("https://tabulamedica.health", "/pricing?plan=pro#yearly"))
      .toBe("https://tabulamedica.health/pricing");
  });

  it("does not ship a third-party analytics tag in the app shell", () => {
    const html = readFileSync(path.join(root, "client/index.html"), "utf8");
    const banned = [
      "plausible.io",
      "usercentrics",
      "googletagmanager",
      "google-analytics",
      "facebook.net",
      "hotjar",
      "segment.com",
      "mixpanel",
      "posthog",
      "doubleclick",
    ];
    for (const token of banned) {
      expect(html.includes(token), token).toBe(false);
    }
    const srcs = [...html.matchAll(/\ssrc="([^"]+)"/g)].map((match) => match[1]);
    expect(srcs.every((src) => src.startsWith("/"))).toBe(true);
    expect(html).toContain('name="referrer" content="strict-origin"');
    expect(html).toContain('referrerpolicy="no-referrer"');
  });

  it("loads the manual script only through the allowlist helper", () => {
    const loader = readFileSync(path.join(root, "client/src/components/public-analytics.tsx"), "utf8");
    expect(loader).toContain("mayLoadThirdPartyAnalytics");
    expect(loader).toContain("script.manual.js");
    expect(loader).not.toContain("outbound-links");
    expect(loader).toContain("authenticated: Boolean(user)");
    const csp = readFileSync(path.join(root, "server/security/mobile-security.ts"), "utf8");
    expect(csp).toContain("https://plausible.io");
    expect(csp).toContain('Referrer-Policy", "strict-origin"');
  });
});

describe("voice policy", () => {
  it("allows on-device and Google Cloud speech and refuses browser recognition", () => {
    expect(assertPhiSpeechEngine("gcp-speech")).toBe("gcp-speech");
    expect(assertPhiSpeechEngine("gcp-tts")).toBe("gcp-tts");
    expect(assertPhiSpeechEngine("on-device")).toBe("on-device");
    expect(preferSpeechEngine(true, "gcp-tts")).toBe("on-device");
    expect(preferSpeechEngine(false, "gcp-speech")).toBe("gcp-speech");
    for (const name of BROWSER_SPEECH_RECOGNITION_APIS) {
      expect(() => assertPhiSpeechEngine(name)).toThrow(/PHI/);
    }
    expect(() => assertPhiSpeechEngine("web-speech")).toThrow(/PHI/);
    expect(() => assertPhiSpeechEngine("openai-whisper")).toThrow(/PHI/);
  });

  it("treats synthesis as on-device only when localService is true", () => {
    expect(localSynthesisAllowed({ localService: true })).toBe(true);
    expect(localSynthesisAllowed({ localService: false })).toBe(false);
    expect(localSynthesisAllowed({})).toBe(false);
    expect(localSynthesisAllowed(undefined)).toBe(false);
  });

  it("fails closed unless the Cloud Speech flag is exactly enabled", () => {
    expect(gcpSpeechFlagEnabled({ GCP_SPEECH_ENABLED: "true" })).toBe(true);
    expect(gcpSpeechFlagEnabled({})).toBe(false);
    expect(gcpSpeechFlagEnabled({ GCP_SPEECH_ENABLED: "1" })).toBe(false);
    expect(gcpSpeechFlagEnabled({ GCP_SPEECH_ENABLED: "false" })).toBe(false);
  });

  it("rejects placeholder transcripts and oversized or unknown audio", () => {
    expect(acceptGcpTranscript({ transcript: "metformin 500 mg", model: "gcp-medasr" })).toBe("metformin 500 mg");
    expect(acceptGcpTranscript({
      transcript: "[MedASR requires GCP credentials for audio transcription.]",
      model: "local-fallback",
    })).toBeNull();
    expect(acceptGcpTranscript({ transcript: "hello", model: "local-fallback" })).toBeNull();
    expect(acceptGcpTranscript({ transcript: "   ", model: "gcp" })).toBeNull();
    expect(encodingForMime("audio/webm;codecs=opus")).toBe("WEBM_OPUS");
    expect(encodingForMime("audio/mp4")).toBeNull();
    const tooBig = parsePhiAudioBody({ audio: "a".repeat(1_500_001), mimeType: "audio/webm" });
    expect(tooBig.ok).toBe(false);
    const bad = parsePhiAudioBody({ audio: "!!!", mimeType: "audio/webm" });
    expect(bad.ok).toBe(false);
    const ok = parsePhiAudioBody({ audio: "YQ==", mimeType: "audio/webm", languageCode: "es-ES" });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.model).toBe("default");
    const english = parsePhiAudioBody({ audio: "YQ==", mimeType: "audio/webm", languageCode: "en-US" });
    if (english.ok) expect(english.model).toBe("medical_dictation");
    expect(parsePhiSpeakBody({ text: "" }).ok).toBe(false);
    expect(parsePhiSpeakBody({ text: "x".repeat(2001) }).ok).toBe(false);
    const spoken = parsePhiSpeakBody({ text: "Your timeline is ready." });
    expect(spoken.ok).toBe(true);
  });
});

describe("browser speech recognition stays out of the client", () => {
  const helper = path.join(root, "client/src/lib/phi-speech.ts");
  const synthesisApis = ["speechSynthesis", "SpeechSynthesisUtterance", "SpeechSynthesisVoice"];

  it("has no direct recognition usage, and synthesis only in the guarded helper", () => {
    const files = walk(path.join(root, "client/src"));
    const violations: string[] = [];
    for (const file of files) {
      const code = stripComments(readFileSync(file, "utf8"));
      const rel = path.relative(root, file);
      for (const name of BROWSER_SPEECH_RECOGNITION_APIS) {
        if (code.includes(name)) violations.push(`${rel} uses ${name}`);
      }
      if (file !== helper) {
        for (const name of synthesisApis) {
          if (code.includes(name)) violations.push(`${rel} uses ${name}`);
        }
      }
    }
    expect(violations).toEqual([]);
    const helperCode = stripComments(readFileSync(helper, "utf8"));
    expect(helperCode).toContain("localSynthesisAllowed");
    expect(helperCode).toContain("preferSpeechEngine");
    expect(helperCode).toContain("/api/voice/phi-transcribe");
    expect(helperCode).not.toContain("SpeechRecognition");
  });

  it("registers the lint rule that fails CI on a new call site", () => {
    const config = readFileSync(path.join(root, "eslint.config.js"), "utf8");
    expect(config).toContain("tabulaSpeech/no-browser-speech-recognition");
    const rule = readFileSync(path.join(root, "eslint-rules/no-browser-speech-recognition.js"), "utf8");
    for (const name of BROWSER_SPEECH_RECOGNITION_APIS) {
      expect(rule).toContain(name);
    }
  });
});

describe("production deploys do not mount OPENAI_API_KEY", () => {
  const scripts = ["deploy.sh", "deploy-world.sh", "deploy-vista.sh", "refresh.sh"];

  it("does not bind the non-BAA key", () => {
    for (const script of scripts) {
      const text = readFileSync(path.join(root, script), "utf8");
      expect(text.includes("OPENAI_API_KEY=OPENAI_API_KEY"), script).toBe(false);
      expect(text.includes("OPENAI_API_KEY:latest"), script).toBe(false);
    }
    const primary = readFileSync(path.join(root, "deploy.sh"), "utf8");
    const refresh = readFileSync(path.join(root, "refresh.sh"), "utf8");
    expect(primary).toContain("--remove-secrets=OPENAI_API_KEY");
    expect(refresh).toContain("--remove-secrets=OPENAI_API_KEY");
  });
});
