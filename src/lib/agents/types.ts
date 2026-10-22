import type { z } from "zod/v4";

// Contrato comum dos provedores de IA usados pelos agentes.

// Arquivo enviado junto do pedido (foto ou PDF da atividade da turma), em base64.
// Só o Claude lê anexos; o texto do pedido continua passando pela anonimização.
export type AgentAttachment = { kind: "image"; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string } | { kind: "pdf"; data: string };

export type AgentRequest<T> = {
  agent: string;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  effort?: "low" | "medium" | "high";
  attachments?: AgentAttachment[];
};

export type AgentModel = <T>(request: AgentRequest<T>) => Promise<T>;

// Andamento de cada agente durante as esperas longas (propor_plano e
// gerar_atividades), para a tela do assistente mostrar só o que é real.
// "queued": a etapa vai acontecer mais tarde (as imagens de apoio, depois das atividades).
export type AgentProgress = { agent: string; phase: "queued" | "start" | "end" | "fail" };

export class AgentOutputError extends Error {}
