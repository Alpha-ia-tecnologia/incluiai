// Geração de imagens pela API da OpenAI (https://developers.openai.com/api/docs/guides/image-generation).
// Só é usada quando OPENAI_API_KEY está definida.

import { hasApiKey } from "../env";

export const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare";
const BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const TIMEOUT_MS = 180_000;

export type ImageSize = "1024x1024" | "1536x1024" | "1024x1536";

export class ImageGenerationError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export function isImageGenerationEnabled(): boolean {
  return hasApiKey("OPENAI_API_KEY");
}

type ImagesResponse = {
  data?: { b64_json?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { code?: string; message?: string };
};

export async function generateImage(prompt: string, size: ImageSize): Promise<{ data: Uint8Array<ArrayBuffer>; mimeType: string; model: string }> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt,
        n: 1,
        size,
        quality: "medium",
        output_format: "webp",
        output_compression: 85,
        background: "opaque",
      }),
    });
  } catch {
    throw new ImageGenerationError("Não foi possível falar com a OpenAI. Tente de novo em instantes.");
  }

  const body = (await response.json().catch(() => ({}))) as ImagesResponse;
  if (!response.ok) {
    if (body.error?.code === "moderation_blocked") {
      throw new ImageGenerationError("A OpenAI recusou esta imagem pelo filtro de conteúdo. Escolha outro tipo de imagem ou reescreva a descrição.", response.status);
    }
    if (response.status === 401) throw new ImageGenerationError("A chave da OpenAI foi recusada.", 401);
    if (response.status === 429) throw new ImageGenerationError("Limite de uso da OpenAI atingido. Tente mais tarde.", 429);
    throw new ImageGenerationError(`A OpenAI respondeu com erro ${response.status}.`, response.status);
  }

  const b64 = body.data?.[0]?.b64_json;
  if (!b64) throw new ImageGenerationError("A OpenAI não devolveu a imagem.");
  console.info(`[imagens] ${IMAGE_MODEL}: ${body.usage?.input_tokens ?? 0} tokens de entrada, ${body.usage?.output_tokens ?? 0} de saída`);
  return { data: new Uint8Array(Buffer.from(b64, "base64")), mimeType: "image/webp", model: IMAGE_MODEL };
}
