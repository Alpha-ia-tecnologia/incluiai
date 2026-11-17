import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AgentOutputError, type AgentModel, type AgentRequest } from "./types";

export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

let client: Anthropic | null = null;
export const claudeClient = () => (client ??= new Anthropic());

// Se o modelo recusar por política, a API tenta o substituto recomendado.
export const SERVER_FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } as const;
export const ADAPTIVE_THINKING = { type: "adaptive" } as const;

export const claudeAgentModel: AgentModel = async <T>(request: AgentRequest<T>) => {
  const response = await claudeClient().beta.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    betas: [...SERVER_FALLBACK.betas],
    fallbacks: SERVER_FALLBACK.fallbacks,
    thinking: ADAPTIVE_THINKING,
    system: request.system,
    messages: [{
      role: "user",
      content: request.attachments?.length
        ? [
          ...request.attachments.map((file) => (file.kind === "pdf"
            ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: file.data } }
            : { type: "image" as const, source: { type: "base64" as const, media_type: file.mediaType, data: file.data } })),
          { type: "text" as const, text: request.prompt },
        ]
        : request.prompt,
    }],
    output_config: { effort: request.effort ?? "medium", format: betaZodOutputFormat(request.schema) },
  });

  console.info(
    `[agentes] ${request.agent} (${response.model}): ${response.usage.input_tokens} tokens de entrada, ${response.usage.output_tokens} de saída`,
  );

  if (response.stop_reason === "refusal") {
    throw new AgentOutputError(`${request.agent}: o pedido foi recusado pelo modelo.`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new AgentOutputError(`${request.agent}: a resposta foi interrompida antes do fim.`);
  }
  if (response.parsed_output == null) {
    throw new AgentOutputError(`${request.agent}: a resposta veio fora do formato esperado.`);
  }
  return response.parsed_output as T;
};
