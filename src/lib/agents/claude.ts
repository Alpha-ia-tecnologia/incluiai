import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AgentOutputError, type AgentModel, type AgentRequest } from "./types";

// Provedor principal: Claude, pelo SDK oficial da Anthropic.

export const AGENT_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

let client: Anthropic | null = null;

export const claudeAgentModel: AgentModel = async <T>(request: AgentRequest<T>) => {
  client ??= new Anthropic();
  const response = await client.beta.messages.parse({
    model: AGENT_MODEL,
    max_tokens: 16000,
    // Se o modelo recusar por política, a API tenta o substituto recomendado.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    system: request.system,
    // Anexos (foto ou PDF) vão antes do texto do pedido.
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

  // Consumo por agente no log do servidor, para acompanhar custos.
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
