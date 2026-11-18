import type { AssistantAction, AssistantConversation, AssistantMessage } from "@prisma/client";
import { db } from "../prisma";
import type { SessionUser } from "../auth";
import { parseJson } from "../format";
import { proposalLabel } from "./proposals";
import type { ActionView, ConversationDetail, ConversationView, MessageView, ToolStep } from "./types";

export const MAX_HISTORY_MESSAGES = 80;

export function toConversationView(conversation: Pick<AssistantConversation, "id" | "title" | "updatedAt">): ConversationView {
  return { id: conversation.id, title: conversation.title, updatedAt: conversation.updatedAt.toISOString() };
}

export function toMessageView(message: AssistantMessage): MessageView {
  return {
    id: message.id,
    role: message.role as MessageView["role"],
    text: message.text,
    steps: parseJson<ToolStep[]>(message.steps, []),
    createdAt: message.createdAt.toISOString(),
  };
}

export function toActionView(action: AssistantAction): ActionView {
  return {
    id: action.id,
    kind: action.kind,
    label: proposalLabel(action.kind),
    summary: action.summary,
    status: action.status as ActionView["status"],
    result: action.result,
    createdAt: action.createdAt.toISOString(),
  };
}

export function historyLength(conversation: Pick<AssistantConversation, "history">): number {
  return parseJson<unknown[]>(conversation.history, []).length;
}

export async function listConversations(userId: string): Promise<ConversationView[]> {
  const prisma = await db();
  const conversations = await prisma.assistantConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 40,
    select: { id: true, title: true, updatedAt: true },
  });
  return conversations.map(toConversationView);
}

export async function getConversation(user: SessionUser, id: string): Promise<ConversationDetail | null> {
  const prisma = await db();
  const conversation = await prisma.assistantConversation.findFirst({
    where: { id, userId: user.id },
    include: { messages: { orderBy: { createdAt: "asc" } }, actions: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) return null;
  return {
    ...toConversationView(conversation),
    messages: conversation.messages.map(toMessageView),
    actions: conversation.actions.map(toActionView),
    long: historyLength(conversation) >= MAX_HISTORY_MESSAGES,
  };
}

export async function latestConversation(user: SessionUser): Promise<ConversationDetail | null> {
  const prisma = await db();
  const latest = await prisma.assistantConversation.findFirst({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, select: { id: true } });
  return latest ? getConversation(user, latest.id) : null;
}

export async function deleteConversation(user: SessionUser, id: string): Promise<boolean> {
  const prisma = await db();
  const result = await prisma.assistantConversation.deleteMany({ where: { id, userId: user.id } });
  return result.count > 0;
}

export async function decidedSinceLastTurn(conversation: Pick<AssistantConversation, "id" | "updatedAt">): Promise<AssistantAction[]> {
  const prisma = await db();
  return prisma.assistantAction.findMany({
    where: { conversationId: conversation.id, status: { in: ["confirmada", "cancelada"] }, decidedAt: { gt: conversation.updatedAt } },
    orderBy: { decidedAt: "asc" },
  });
}
