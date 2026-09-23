/**
 * PHI-AI routing regression tests.
 *
 * Recent PHI safety fixes changed default AI routing from consumer OpenAI to
 * Vertex (Google BAA) and removed the silent OpenAI fallback on Vertex errors.
 * These tests keep that behavior explicit without calling any live AI service.
 *
 * Run:
 *   npx vitest run tests/phi-ai-routing.spec.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

const openAiCreate = vi.fn();
const openAiConstructorArgs: unknown[] = [];

const vertexConstructorArgs: unknown[] = [];
const getGenerativeModel = vi.fn();
const generateContent = vi.fn();
const generateContentStream = vi.fn();

const googleAuthConstructorArgs: unknown[] = [];
const getAccessToken = vi.fn();

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.AI_DEFAULT_PROVIDER;
  delete process.env.AI_PROVIDER;
  delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  delete process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  delete process.env.VERTEX_PROJECT_ID;
  delete process.env.VERTEX_LOCATION;
  delete process.env.VERTEX_MODEL_ID;
  delete process.env.GOOGLE_CLOUD_PROJECT;
}

function installAiProviderMocks() {
  vi.doMock("openai", () => ({
    default: class MockOpenAI {
      chat = { completions: { create: openAiCreate } };

      constructor(args: unknown) {
        openAiConstructorArgs.push(args);
      }
    },
  }));

  vi.doMock("@google-cloud/vertexai", () => ({
    VertexAI: class MockVertexAI {
      constructor(args: unknown) {
        vertexConstructorArgs.push(args);
      }

      getGenerativeModel(args: unknown) {
        getGenerativeModel(args);
        return { generateContent, generateContentStream };
      }
    },
    GenerativeModel: class MockGenerativeModel {},
    HarmCategory: {
      HARM_CATEGORY_DANGEROUS_CONTENT: "dangerous_content",
      HARM_CATEGORY_HARASSMENT: "harassment",
    },
    HarmBlockThreshold: {
      BLOCK_MEDIUM_AND_ABOVE: "block_medium_and_above",
    },
  }));
}

function installBaaChatMocks(fetchMock: ReturnType<typeof vi.fn>) {
  vi.doMock("google-auth-library", () => ({
    GoogleAuth: class MockGoogleAuth {
      constructor(args: unknown) {
        googleAuthConstructorArgs.push(args);
      }

      getAccessToken = getAccessToken;
    },
  }));

  vi.stubGlobal("fetch", fetchMock);
}

async function loadAiProvider() {
  installAiProviderMocks();
  return import("../server/services/ai-provider");
}

async function loadBaaChat(fetchMock: ReturnType<typeof vi.fn>) {
  installBaaChatMocks(fetchMock);
  return import("../server/lib/baa-chat");
}

async function collectStream(stream: AsyncGenerator<string, void, unknown>) {
  const chunks: string[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks.join("");
}

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  resetEnv();
  openAiConstructorArgs.length = 0;
  vertexConstructorArgs.length = 0;
  googleAuthConstructorArgs.length = 0;
  generateContent.mockResolvedValue({
    response: {
      candidates: [{ content: { parts: [{ text: "safe " }, { text: "vertex" }] } }],
    },
  });
  generateContentStream.mockResolvedValue({
    stream: (async function* () {
      yield { candidates: [{ content: { parts: [{ text: "streamed " }] } }] };
      yield { candidates: [{ content: { parts: [{ text: "vertex" }] } }] };
    })(),
  });
  openAiCreate.mockResolvedValue({
    choices: [{ message: { content: "explicit openai" } }],
  });
  getAccessToken.mockResolvedValue("vertex-token");
});

describe("server/services/ai-provider PHI fail-closed routing", () => {
  it("defaults to Vertex when AI_DEFAULT_PROVIDER is unset", async () => {
    process.env.VERTEX_PROJECT_ID = "phr-test-project";
    process.env.VERTEX_LOCATION = "us-east1";

    const { generateText, getProviderStatus } = await loadAiProvider();

    await expect(
      generateText({
        systemPrompt: "Use only the clinical chart.",
        userPrompt: "Summarize this patient record.",
        temperature: 0.2,
        maxTokens: 256,
        responseFormat: "json",
      }),
    ).resolves.toBe("safe vertex");

    expect(getProviderStatus().defaultProvider).toBe("vertex");
    expect(vertexConstructorArgs).toEqual([{ project: "phr-test-project", location: "us-east1" }]);
    expect(getGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gemini-1.5-pro" }),
    );
    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        generationConfig: expect.objectContaining({ responseMimeType: "application/json" }),
      }),
    );
    expect(openAiCreate).not.toHaveBeenCalled();
    expect(openAiConstructorArgs).toHaveLength(0);
  });

  it("fails closed instead of falling back to OpenAI when Vertex generation errors", async () => {
    generateContent.mockRejectedValueOnce(new Error("Vertex quota exhausted"));

    const { generateText } = await loadAiProvider();

    await expect(generateText({ userPrompt: "contains PHI" })).rejects.toThrow(
      "AI temporarily unavailable. Please try again.",
    );
    expect(openAiCreate).not.toHaveBeenCalled();
    expect(openAiConstructorArgs).toHaveLength(0);
  });

  it("fails closed instead of falling back to OpenAI when Vertex streaming errors", async () => {
    generateContentStream.mockRejectedValueOnce(new Error("Vertex stream unavailable"));

    const { streamText } = await loadAiProvider();

    await expect(collectStream(streamText({ userPrompt: "stream PHI" }))).rejects.toThrow(
      "AI temporarily unavailable. Please try again.",
    );
    expect(openAiCreate).not.toHaveBeenCalled();
    expect(openAiConstructorArgs).toHaveLength(0);
  });

  it("uses OpenAI only after an explicit runtime provider override", async () => {
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "test-key";
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = "https://non-phi-ai.example.test/v1";

    const { generateText, setDefaultProvider } = await loadAiProvider();
    setDefaultProvider("openai");

    await expect(generateText({ userPrompt: "non-PHI dev prompt" })).resolves.toBe(
      "explicit openai",
    );

    expect(openAiConstructorArgs).toEqual([
      { apiKey: "test-key", baseURL: "https://non-phi-ai.example.test/v1" },
    ]);
    expect(openAiCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o",
        messages: [{ role: "user", content: "non-PHI dev prompt" }],
      }),
    );
    expect(generateContent).not.toHaveBeenCalled();
  });
});

describe("server/lib/baa-chat raw-fetch routing", () => {
  it("routes raw chat payloads to the Vertex OpenAI-compatible endpoint by default", async () => {
    process.env.VERTEX_PROJECT_ID = "phr-test-project";
    process.env.VERTEX_LOCATION = "us-east1";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const { baaChatFetch, isAiConfigured } = await loadBaaChat(fetchMock);

    expect(isAiConfigured()).toBe(true);
    await baaChatFetch({
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "patient context" }],
      }),
      headers: { Authorization: "Bearer legacy-openai-key" },
    });

    expect(googleAuthConstructorArgs).toEqual([
      { scopes: ["https://www.googleapis.com/auth/cloud-platform"] },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://us-east1-aiplatform.googleapis.com/v1beta1/projects/phr-test-project/locations/us-east1/endpoints/openapi/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer vertex-token",
        },
      }),
    );
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.model).toBe("google/gemini-2.5-flash");
    expect(requestBody.messages).toEqual([{ role: "user", content: "patient context" }]);
    expect(requestBody.extra_body).toEqual({
      google: { thinking_config: { thinking_budget: 0 } },
    });
  });

  it("refuses explicit OpenAI mode unless both key and base URL are configured", async () => {
    process.env.AI_PROVIDER = "openai";
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "test-key";
    const fetchMock = vi.fn();

    const { baaChatFetch } = await loadBaaChat(fetchMock);

    await expect(baaChatFetch({ body: { messages: [] } })).rejects.toThrow(
      "AI_PROVIDER=openai requires AI_INTEGRATIONS_OPENAI_API_KEY + AI_INTEGRATIONS_OPENAI_BASE_URL",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses only the explicit base URL for non-PHI OpenAI opt-in", async () => {
    process.env.AI_PROVIDER = "openai";
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "test-key";
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = "https://non-phi-ai.example.test/v1";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const { baaChatFetch, isAiConfigured } = await loadBaaChat(fetchMock);

    expect(isAiConfigured()).toBe(true);
    await baaChatFetch({
      body: { model: "gpt-4o-mini", messages: [{ role: "user", content: "dev fixture" }] },
      headers: { Authorization: "Bearer caller-supplied-key" },
    });

    expect(googleAuthConstructorArgs).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://non-phi-ai.example.test/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        },
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "dev fixture" }],
    });
  });
});
