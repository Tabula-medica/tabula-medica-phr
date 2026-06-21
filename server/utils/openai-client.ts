import OpenAI from "openai";

export { sanitizeHealthData, sanitizeChatMessages, prepareAIRequest } from "./phi-sanitizer";

let _sharedClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (_sharedClient) return _sharedClient;

  const apiKey =
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY;

  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined;

  if (!apiKey) {
    throw new Error(
      "OpenAI API key not configured. Set AI_INTEGRATIONS_OPENAI_API_KEY or OPENAI_API_KEY.",
    );
  }

  _sharedClient = new OpenAI({ apiKey, baseURL });
  return _sharedClient;
}

export function hasOpenAIKey(): boolean {
  return !!(
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY
  );
}
