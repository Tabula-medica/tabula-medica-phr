/**
 * Custom ESLint rule: no-browser-speech-recognition
 *
 * Browser SpeechRecognition / webkitSpeechRecognition sends microphone audio
 * to the browser vendor (Google, in Chrome). That is not covered by the
 * Cloud BAA. speechSynthesis is allowed only in client/src/lib/phi-speech.ts,
 * which speaks with a localService voice or Google Cloud TTS.
 *
 * The banned constructor names live in shared/voice/policy.ts. This rule
 * duplicates them because the flat config cannot import TypeScript.
 */

const RECOGNITION = new Set(["SpeechRecognition", "webkitSpeechRecognition"]);
const SYNTHESIS = new Set(["speechSynthesis", "SpeechSynthesisUtterance", "SpeechSynthesisVoice"]);

function isTtsHelper(filename) {
  return String(filename || "").replace(/\\/g, "/").endsWith("client/src/lib/phi-speech.ts");
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow browser speech recognition and ungated speech synthesis. PHI audio goes through Google Cloud Speech under the BAA.",
      recommended: false,
    },
    messages: {
      recognition:
        "Browser SpeechRecognition sends audio to a consumer service outside the Cloud BAA. Use client/src/lib/phi-speech.ts (GCP Speech-to-Text, or typed input when it is off).",
      synthesis:
        "speechSynthesis may speak PHI only from client/src/lib/phi-speech.ts after localService === true, otherwise Google Cloud TTS.",
    },
    schema: [],
  },

  create(context) {
    const helper = isTtsHelper(context.filename);
    function checkName(node, name) {
      if (typeof name !== "string") return;
      if (RECOGNITION.has(name)) {
        context.report({ node, messageId: "recognition" });
        return;
      }
      if (!helper && SYNTHESIS.has(name)) {
        context.report({ node, messageId: "synthesis" });
      }
    }
    return {
      Identifier(node) {
        checkName(node, node.name);
      },
      Literal(node) {
        checkName(node, node.value);
      },
    };
  },
};

export default {
  rules: {
    "no-browser-speech-recognition": rule,
  },
};
