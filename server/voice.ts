import type { Express, Request, Response } from "express";
import { Buffer } from "node:buffer";
import { speechToText, textToSpeech, openai } from "./replit_integrations/audio/client";
import { requireUser, getUserId, aiUserRateLimiter } from "./middleware/require-user";

// P0-3: voice STT, LLM, and TTS all route through OpenAI (non-BAA) via the Replit
// integration — voice audio and transcripts are PHI. Gate the entire feature OFF
// by default until the Vertex/BAA gateway lands (P1). Set VOICE_LLM_ENABLED=true
// only in an environment where these calls are BAA-covered.
const VOICE_LLM_ENABLED = process.env.VOICE_LLM_ENABLED === "true";
const VOICE_DISABLED_MSG =
  "I can navigate and read your records; free-form questions are temporarily disabled.";

const HEALTH_SYSTEM_PROMPT = `You are a helpful health assistant for Tabula Medica, a patient health records app. 
You help patients understand their health information and navigate the app.

Key behaviors:
- Explain medical terms in plain, simple language
- Be empathetic and supportive
- Never provide medical advice or diagnoses
- Direct patients to their healthcare providers for medical concerns
- Help with app navigation (timeline, medications, documents, conditions, appointments)
- Keep responses concise for voice (2-3 sentences max)

Available commands:
- Navigation: "go to timeline", "show medications", "open documents", "view conditions", "check appointments"
- Explanations: "what is [medical term]", "explain [condition]"
- Reading data: "read my allergies", "what medications am I taking"`;

interface VoiceCommand {
  type: "navigate" | "explain" | "read" | "general";
  target?: string;
  route?: string;
}

function parseVoiceCommand(transcript: string): VoiceCommand {
  const lower = transcript.toLowerCase();
  
  if (lower.includes("timeline") || lower.includes("events") || lower.includes("history")) {
    return { type: "navigate", target: "timeline", route: "/timeline" };
  }
  if (lower.includes("medication") || lower.includes("medicine") || lower.includes("prescription") || lower.includes("drug")) {
    return { type: "navigate", target: "medications", route: "/medications" };
  }
  if (lower.includes("document") || lower.includes("report") || lower.includes("result") || lower.includes("lab")) {
    return { type: "navigate", target: "documents", route: "/documents" };
  }
  if (lower.includes("condition") || lower.includes("diagnos") || lower.includes("problem") || lower.includes("allerg")) {
    return { type: "navigate", target: "conditions", route: "/conditions" };
  }
  if (lower.includes("appointment") || lower.includes("schedule") || lower.includes("visit")) {
    return { type: "navigate", target: "appointments", route: "/" };
  }
  if (lower.includes("security") || lower.includes("setting") || lower.includes("password") || lower.includes("2fa")) {
    return { type: "navigate", target: "security", route: "/security" };
  }
  if (lower.includes("connection") || lower.includes("ehr") || lower.includes("hospital") || lower.includes("connect")) {
    return { type: "navigate", target: "connections", route: "/connections" };
  }
  if (lower.includes("learn") || lower.includes("education") || lower.includes("health topic")) {
    return { type: "navigate", target: "learn", route: "/learn" };
  }
  if (lower.includes("home") || lower.includes("dashboard") || lower.includes("main")) {
    return { type: "navigate", target: "dashboard", route: "/" };
  }
  
  if (lower.includes("what is") || lower.includes("explain") || lower.includes("tell me about") || lower.includes("define")) {
    return { type: "explain" };
  }
  
  if (lower.includes("read") || lower.includes("list") || lower.includes("what are my")) {
    return { type: "read" };
  }
  
  return { type: "general" };
}

export function registerVoiceRoutes(app: Express): void {
  app.post("/api/voice/command", requireUser, aiUserRateLimiter, async (req: Request, res: Response) => {
    try {
      if (!VOICE_LLM_ENABLED) {
        return res.json({ transcript: "", response: VOICE_DISABLED_MSG, audio: null, navigation: null, command: "general" });
      }
      const { audio, format = "webm", language = "en" } = req.body;
      
      if (!audio) {
        return res.status(400).json({ error: "Audio data (base64) is required" });
      }
      
      const audioBuffer = Buffer.from(audio, "base64");
      
      const transcript = await speechToText(audioBuffer, format);
      
      const command = parseVoiceCommand(transcript);
      
      let responseText = "";
      let navigationRoute: string | null = null;
      
      if (command.type === "navigate" && command.route) {
        navigationRoute = command.route;
        responseText = `Taking you to ${command.target}.`;
      } else if (command.type === "explain" || command.type === "general") {
        const completion = await openai.chat.completions.create({
          model: "gpt-5.1",
          messages: [
            { role: "system", content: HEALTH_SYSTEM_PROMPT },
            { role: "user", content: transcript }
          ],
          max_completion_tokens: 150,
        });
        responseText = completion.choices[0]?.message?.content || "I'm sorry, I didn't understand that. Could you try again?";
      } else if (command.type === "read") {
        // P0-3: the previous implementation read allergies/medications across ALL
        // patients via global getters (storage.getAllergies()/getPatients()) — a
        // cross-patient PHI disclosure. Never call the global getters from a
        // request path. Until a user-scoped voice reader lands (P1), do not read
        // record data here; direct the authenticated user to their records screen.
        getUserId(req);
        responseText = "You can view your allergies and medications on your records screen.";
      }
      
      const audioResponse = await textToSpeech(responseText, "alloy", "mp3");
      
      res.json({
        transcript,
        response: responseText,
        audio: audioResponse.toString("base64"),
        navigation: navigationRoute,
        command: command.type,
      });
    } catch (error) {
      // PHI-safe: error objects can carry transcript fragments — log message only.
      console.error("Voice command error:", error instanceof Error ? error.message : "unknown");
      res.status(500).json({ error: "Failed to process voice command" });
    }
  });

  app.post("/api/voice/explain-term", requireUser, aiUserRateLimiter, async (req: Request, res: Response) => {
    try {
      if (!VOICE_LLM_ENABLED) {
        return res.json({ term: "", explanation: VOICE_DISABLED_MSG, audio: null });
      }
      const { audio, format = "webm" } = req.body;
      
      if (!audio) {
        return res.status(400).json({ error: "Audio data (base64) is required" });
      }
      
      const audioBuffer = Buffer.from(audio, "base64");
      const transcript = await speechToText(audioBuffer, format);
      
      const completion = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { 
            role: "system", 
            content: "You are a helpful medical educator. Explain medical terms in plain, simple language that anyone can understand. Keep explanations to 2-3 sentences. Never provide medical advice."
          },
          { role: "user", content: `Explain this in simple terms: ${transcript}` }
        ],
        max_completion_tokens: 150,
      });
      
      const explanation = completion.choices[0]?.message?.content || "I couldn't explain that term. Please try again.";
      
      const audioResponse = await textToSpeech(explanation, "alloy", "mp3");
      
      res.json({
        term: transcript,
        explanation,
        audio: audioResponse.toString("base64"),
      });
    } catch (error) {
      console.error("Voice explain error:", error instanceof Error ? error.message : "unknown");
      res.status(500).json({ error: "Failed to explain term" });
    }
  });

  app.post("/api/voice/text-to-speech", requireUser, aiUserRateLimiter, async (req: Request, res: Response) => {
    try {
      if (!VOICE_LLM_ENABLED) {
        return res.status(503).json({ error: "Voice output is temporarily disabled." });
      }
      const { text, voice = "alloy" } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }
      
      const audioBuffer = await textToSpeech(text, voice, "mp3");
      
      res.json({
        audio: audioBuffer.toString("base64"),
      });
    } catch (error) {
      console.error("TTS error:", error instanceof Error ? error.message : "unknown");
      res.status(500).json({ error: "Failed to convert text to speech" });
    }
  });
}
