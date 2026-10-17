import type { AssistantAction, AssistantConversation, AssistantMessage } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "../prisma";
import type { SessionUser } from "../auth";
import { decideActivity, saveDiaryEntry, saveFamilyNote, saveIntersectorReport, setObjectiveStatus, type DiaryEntryInput, type IntersectorReportInput } from "../records";
import { parseJson } from "../format";
import type { ActionView, ConversationDetail, ConversationView, MessageView, ToolStep } from "./types";

// Conversas do assistente: leitura para a tela e execução das ações que a
// pessoa confirmou. O histórico enviado ao modelo só recebe acréscimos; quando
// fica longo demais, a pessoa começa outra conversa.

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
  const conversations = await prisma.assistantConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 40,
    select: { id: true, title: true, updatedAt: true },
  });
  return conversations.map(toConversationView);
}

export async function getConversation(user: SessionUser, id: string): Promise<ConversationDetail | null> {
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
  const latest = await prisma.assistantConversation.findFirst({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, select: { id: true } });
  return latest ? getConversation(user, latest.id) : null;
}

export async function deleteConversation(user: SessionUser, id: string): Promise<boolean> {
  const result = await prisma.assistantConversation.deleteMany({ where: { id, userId: user.id } });
  return result.count > 0;
}

// Ações decididas depois do último turno, para o modelo saber o que aconteceu.
export async function decidedSinceLastTurn(conversation: Pick<AssistantConversation, "id" | "updatedAt">): Promise<AssistantAction[]> {
  return prisma.assistantAction.findMany({
    where: { conversationId: conversation.id, status: { in: ["confirmada", "cancelada"] }, decidedAt: { gt: conversation.updatedAt } },
    orderBy: { decidedAt: "asc" },
  });
}

type ActionArgs = Record<string, unknown> & { studentId: string };

// Executa o que a pessoa confirmou. As permissões são conferidas de novo
// aqui, com a pessoa que confirma: o cartão não é um passe livre.
export async function executeAction(user: SessionUser, actionId: string, decision: "confirmar" | "cancelar"): Promise<{ action: ActionView; error?: string }> {
  const action = await prisma.assistantAction.findFirst({ where: { id: actionId, conversation: { userId: user.id } } });
  if (!action) throw new Error("Ação não encontrada.");
  if (action.status !== "pendente") return { action: toActionView(action) };

  if (decision === "cancelar") {
    const cancelled = await prisma.assistantAction.update({ where: { id: action.id }, data: { status: "cancelada", decidedAt: new Date(), result: null } });
    return { action: toActionView(cancelled) };
  }

  const args = parseJson<ActionArgs>(action.args, { studentId: "" });
  try {
    const result = await perform(user, action.kind, args);
    // O cartão guarda o resultado; o modelo fica sabendo no próximo turno (decidedSinceLastTurn).
    const confirmed = await prisma.assistantAction.update({ where: { id: action.id }, data: { status: "confirmada", decidedAt: new Date(), result } });
    return { action: toActionView(confirmed) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível executar a ação.";
    return { action: toActionView(action), error: message };
  }
}

async function perform(user: SessionUser, kind: string, args: ActionArgs): Promise<string> {
  const studentId = String(args.studentId ?? "");
  switch (kind) {
    case "registrar_aula": {
      await saveDiaryEntry(user, studentId, args as unknown as DiaryEntryInput);
      revalidatePath("/estudantes/[id]", "layout");
      revalidatePath("/");
      return `Registro da aula salvo. Veja em [Registrar aula](/estudantes/${studentId}/diario).`;
    }
    case "decidir_atividade": {
      const decision = args.decision === "rejeitada" ? "rejeitada" : "aceita";
      const activity = await decideActivity(user, studentId, String(args.activityId), decision, typeof args.reason === "string" ? args.reason : null);
      revalidatePath("/estudantes/[id]", "layout");
      return decision === "aceita"
        ? `Atividade “${activity.title}” aceita. Veja em [Atividades](/estudantes/${studentId}/atividades).`
        : `Atividade “${activity.title}” rejeitada. O motivo ajuda a melhorar as sugestões.`;
    }
    case "marcar_objetivo": {
      const status = args.status === "alcancado" ? "alcancado" : args.status === "em_revisao" ? "em_revisao" : "ativo";
      await setObjectiveStatus(user, studentId, String(args.objectiveId), status);
      revalidatePath("/estudantes/[id]", "layout");
      const label = status === "alcancado" ? "alcançado" : status === "em_revisao" ? "em revisão" : "ativo";
      return `Objetivo marcado como ${label}. Veja em [Plano de ensino](/estudantes/${studentId}/ppi).`;
    }
    case "contar_conquista": {
      await saveFamilyNote(user, studentId, String(args.note ?? ""), String(args.author ?? "Família"));
      revalidatePath(`/familia/${studentId}`);
      revalidatePath(`/estudantes/${studentId}`);
      return `Conquista enviada para a equipe da escola. Veja em [Acompanhamento](/familia/${studentId}).`;
    }
    case "enviar_orientacoes": {
      await saveIntersectorReport(user, studentId, args as unknown as IntersectorReportInput);
      revalidatePath("/terapeuta");
      revalidatePath(`/estudantes/${studentId}`);
      return "Relatório enviado para a equipe escolar. Veja em [Orientações](/terapeuta#relatorios).";
    }
    default:
      throw new Error("Tipo de ação desconhecido.");
  }
}
