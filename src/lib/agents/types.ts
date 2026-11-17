import type { z } from "zod/v4";

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

export type AgentProgress = { agent: string; phase: "queued" | "start" | "end" | "fail" };
export type AgentReport = (progress: AgentProgress) => void;

export type TraceStep = { agent: string; summary: string };

export class AgentOutputError extends Error {}

// Vários agentes em paralelo que falham juntos chegam do LangGraph como um
// AggregateError.
export const firstAgentError = (error: unknown): unknown => (error instanceof AggregateError && error.errors.length ? error.errors[0] : error);
