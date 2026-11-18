import { z } from "zod/v4";
import { AgentOutputError, type AgentModel, type AgentRequest } from "./types";
import { deepseekSettings } from "../env-config";

// DeepSeek, pela API HTTP no formato OpenAI (https://api-docs.deepseek.com).
// Atenção (LGPD): a DeepSeek processa e armazena dados na China.
//
// O modo JSON da DeepSeek garante JSON válido, mas não segue um esquema.

export const DEEPSEEK_MODEL = deepseekSettings().model;
const TIMEOUT_MS = 240_000;

type ChatCompletion = {
  model?: string;
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export class DeepSeekAPIError extends Error {
  constructor(readonly status: number) {
    super(`DeepSeek respondeu com erro ${status}.`);
  }
}

export function extractJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const text = (fenced ? fenced[1] : content).trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new SyntaxError("sem objeto JSON");
  }
}

async function callOnce<T>(request: AgentRequest<T>, schema: string): Promise<T> {
  const { apiKey, baseUrl } = deepseekSettings();
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      max_tokens: 16000,
      reasoning_effort: request.effort === "low" ? "low" : "high",
      response_format: { type: "json_object" },
      stream: false,
      messages: [
        {
          role: "system",
          content: `${request.system}\n\nResponda somente com um objeto JSON válido, sem texto antes ou depois, que siga exatamente este JSON Schema:\n${schema}`,
        },
        { role: "user", content: request.prompt },
      ],
    }),
  });
  if (!response.ok) throw new DeepSeekAPIError(response.status);

  const data = (await response.json()) as ChatCompletion;
  console.info(
    `[agentes] ${request.agent} (${data.model ?? DEEPSEEK_MODEL}): ${data.usage?.prompt_tokens ?? 0} tokens de entrada, ${data.usage?.completion_tokens ?? 0} de saída`,
  );
  const choice = data.choices?.[0];
  if (choice?.finish_reason === "length") {
    throw new AgentOutputError(`${request.agent}: a resposta do DeepSeek foi interrompida antes do fim.`);
  }
  const content = choice?.message?.content?.trim();
  if (!content) throw new RetryableOutputError(`${request.agent}: o DeepSeek devolveu uma resposta vazia.`);

  let parsed: unknown;
  try {
    parsed = extractJson(content);
  } catch {
    throw new RetryableOutputError(`${request.agent}: o DeepSeek devolveu um JSON inválido.`);
  }
  const result = request.schema.safeParse(parsed);
  if (!result.success) throw new RetryableOutputError(`${request.agent}: a resposta do DeepSeek veio fora do formato esperado.`);
  return result.data;
}

// Resposta vazia ou JSON fora do esperado acontecem de vez em quando no modo
// JSON da DeepSeek.
class RetryableOutputError extends AgentOutputError {}
const MAX_ATTEMPTS = 2;

export const deepseekAgentModel: AgentModel = async <T>(request: AgentRequest<T>) => {
  // O DeepSeek não lê imagem nem PDF: a leitura do arquivo fica só com o Claude.
  if (request.attachments?.length) throw new AgentOutputError(`${request.agent}: o DeepSeek não lê imagem nem PDF.`);
  const schema = JSON.stringify(z.toJSONSchema(request.schema));
  for (let attempt = 1; ; attempt++) {
    try {
      return await callOnce(request, schema);
    } catch (error) {
      if (!(error instanceof RetryableOutputError) || attempt >= MAX_ATTEMPTS) throw error;
      console.warn(`[agentes] ${error.message} Tentando de novo.`);
    }
  }
};
