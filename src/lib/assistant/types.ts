// Tipos compartilhados entre o servidor e a tela do assistente.
import type { AgentProgress } from "../agents/types";

export type { AgentProgress };

export type ToolStep = { id: string; name: string; label: string; ok?: boolean; summary?: string; progress?: AgentProgress[] };

export type ActionView = {
  id: string;
  kind: string;
  summary: string;
  status: "pendente" | "confirmada" | "cancelada";
  result: string | null;
  createdAt: string;
};

export type MessageView = {
  id: string;
  role: "usuario" | "assistente" | "sistema";
  text: string;
  steps: ToolStep[];
  createdAt: string;
};

export type ConversationView = { id: string; title: string; updatedAt: string };

export type ConversationDetail = ConversationView & { messages: MessageView[]; actions: ActionView[]; long: boolean };

// Eventos transmitidos durante um turno (SSE).
export type AssistantEvent =
  | { type: "conversation"; conversation: ConversationView }
  | { type: "text"; delta: string }
  | { type: "tool_start"; step: ToolStep }
  | { type: "tool_progress"; id: string; progress: AgentProgress }
  | { type: "tool_end"; step: ToolStep }
  | { type: "action"; action: ActionView }
  | { type: "done"; message: MessageView; conversation: ConversationView; long: boolean }
  | { type: "error"; message: string };
