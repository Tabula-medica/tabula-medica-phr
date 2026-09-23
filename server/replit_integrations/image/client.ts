import { Buffer } from "node:buffer";

const BAA_ERROR = "Image generation (DALL-E) is disabled: OpenAI has no BAA. Use a BAA-covered image service.";

/**
 * DISABLED — no OpenAI BAA. Throws on any call.
 * A BAA-covered image generation service (e.g. Vertex Imagen) must be wired
 * in before this function is re-enabled.
 */
export async function generateImageBuffer(
  _prompt: string,
  _size?: "1024x1024" | "512x512" | "256x256"
): Promise<Buffer> {
  throw new Error(BAA_ERROR);
}

/**
 * DISABLED — no OpenAI BAA. Throws on any call.
 */
export async function editImages(
  _imageFiles: string[],
  _prompt: string,
  _outputPath?: string
): Promise<Buffer> {
  throw new Error(BAA_ERROR);
}

