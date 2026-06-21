import OpenAI from "openai";
import { VertexAI, GenerativeModel, HarmCategory, HarmBlockThreshold } from "@google-cloud/vertexai";

export type AIProvider = "openai" | "vertex";

export interface AIGenerateOptions {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  responseFormat?: "text" | "json";
}

export interface AIStreamOptions extends AIGenerateOptions {
  onChunk: (chunk: string) => void;
}

export interface AIProviderConfig {
  defaultProvider: AIProvider;
  featureOverrides: Record<string, AIProvider>;
}

const providerConfig: AIProviderConfig = {
  defaultProvider: (process.env.AI_DEFAULT_PROVIDER as AIProvider) || "openai",
  featureOverrides: {},
};

let openaiClient: OpenAI | null = null;
let vertexClient: VertexAI | null = null;
let vertexModel: GenerativeModel | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return openaiClient;
}

function getVertexClient(): VertexAI {
  if (!vertexClient) {
    const projectId = process.env.VERTEX_PROJECT_ID || "united-planet-485003-n7";
    const location = process.env.VERTEX_LOCATION || "us-central1";

    if (process.env.VERTEX_SERVICE_ACCOUNT_JSON) {
      try {
        const credentials = JSON.parse(
          Buffer.from(process.env.VERTEX_SERVICE_ACCOUNT_JSON, "base64").toString("utf-8")
        );
        process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = JSON.stringify(credentials);
      } catch (e) {
        console.warn("[AIProvider] Failed to parse VERTEX_SERVICE_ACCOUNT_JSON, falling back to default credentials");
      }
    }

    vertexClient = new VertexAI({
      project: projectId,
      location: location,
    });
  }
  return vertexClient;
}

function getVertexModel(modelId?: string): GenerativeModel {
  const client = getVertexClient();
  const model = modelId || process.env.VERTEX_MODEL_ID || "gemini-1.5-pro";
  return client.getGenerativeModel({
    model,
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ],
  });
}

export function getProviderForFeature(feature: string): AIProvider {
  if (providerConfig.featureOverrides[feature]) {
    return providerConfig.featureOverrides[feature];
  }
  return providerConfig.defaultProvider;
}

export function setFeatureProvider(feature: string, provider: AIProvider): void {
  providerConfig.featureOverrides[feature] = provider;
}

export function setDefaultProvider(provider: AIProvider): void {
  providerConfig.defaultProvider = provider;
}

export async function generateText(
  options: AIGenerateOptions,
  feature?: string
): Promise<string> {
  const provider = feature ? getProviderForFeature(feature) : providerConfig.defaultProvider;

  console.log(`[AIProvider] Using ${provider} for feature: ${feature || "default"}`);

  if (provider === "vertex") {
    return generateWithVertex(options);
  }
  return generateWithOpenAI(options);
}

async function generateWithOpenAI(options: AIGenerateOptions): Promise<string> {
  const client = getOpenAIClient();
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (options.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }
  messages.push({ role: "user", content: options.userPrompt });

  const response = await client.chat.completions.create({
    model: options.model || "gpt-4o",
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens || 2048,
    ...(options.responseFormat === "json" ? { response_format: { type: "json_object" as const } } : {}),
  });

  return response.choices[0]?.message?.content || "";
}

async function generateWithVertex(options: AIGenerateOptions): Promise<string> {
  try {
    const model = getVertexModel(options.model);

    const parts: Array<{ text: string }> = [];
    if (options.systemPrompt) {
      parts.push({ text: `System Instructions: ${options.systemPrompt}\n\n` });
    }
    parts.push({ text: options.userPrompt });

    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens || 2048,
        ...(options.responseFormat === "json" ? { responseMimeType: "application/json" } : {}),
      },
    });

    const response = result.response;
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      if (candidate.content?.parts) {
        return candidate.content.parts.map(p => p.text || "").join("");
      }
    }
    return "";
  } catch (error: any) {
    console.error("[AIProvider] Vertex AI error, falling back to OpenAI:", error.message);
    return generateWithOpenAI(options);
  }
}

export async function* streamText(
  options: AIGenerateOptions,
  feature?: string
): AsyncGenerator<string, void, unknown> {
  const provider = feature ? getProviderForFeature(feature) : providerConfig.defaultProvider;

  console.log(`[AIProvider] Streaming with ${provider} for feature: ${feature || "default"}`);

  if (provider === "vertex") {
    yield* streamWithVertex(options);
  } else {
    yield* streamWithOpenAI(options);
  }
}

async function* streamWithOpenAI(options: AIGenerateOptions): AsyncGenerator<string, void, unknown> {
  const client = getOpenAIClient();
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (options.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }
  messages.push({ role: "user", content: options.userPrompt });

  const stream = await client.chat.completions.create({
    model: options.model || "gpt-4o",
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens || 2048,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

async function* streamWithVertex(options: AIGenerateOptions): AsyncGenerator<string, void, unknown> {
  try {
    const model = getVertexModel(options.model);

    const parts: Array<{ text: string }> = [];
    if (options.systemPrompt) {
      parts.push({ text: `System Instructions: ${options.systemPrompt}\n\n` });
    }
    parts.push({ text: options.userPrompt });

    const streamResult = await model.generateContentStream({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens || 2048,
      },
    });

    for await (const chunk of streamResult.stream) {
      if (chunk.candidates && chunk.candidates.length > 0) {
        const candidate = chunk.candidates[0];
        if (candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.text) {
              yield part.text;
            }
          }
        }
      }
    }
  } catch (error: any) {
    console.error("[AIProvider] Vertex AI streaming error, falling back to OpenAI:", error.message);
    yield* streamWithOpenAI(options);
  }
}

export function getProviderStatus(): {
  defaultProvider: AIProvider;
  openaiAvailable: boolean;
  vertexAvailable: boolean;
  vertexProjectId: string | undefined;
  vertexLocation: string | undefined;
  featureOverrides: Record<string, AIProvider>;
} {
  return {
    defaultProvider: providerConfig.defaultProvider,
    openaiAvailable: !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    vertexAvailable: !!(process.env.VERTEX_PROJECT_ID || process.env.VERTEX_SERVICE_ACCOUNT_JSON),
    vertexProjectId: process.env.VERTEX_PROJECT_ID,
    vertexLocation: process.env.VERTEX_LOCATION,
    featureOverrides: { ...providerConfig.featureOverrides },
  };
}

export { getOpenAIClient, getVertexClient };
