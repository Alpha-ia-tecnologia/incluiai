import "server-only";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { db } from "./prisma";
import { assertStudentTeam, type SessionUser } from "./auth";
import { AUDIT_ACTION, recordChange } from "./audit";
import { validBnccCode } from "./bncc";
import { UserError } from "./user-error";
import { invalidateStudent } from "./invalidate";
import { runAiJob } from "./agents/job";
import type { RedactionScope } from "./agents/names-in-scope";
import { profileText } from "./agents/context";
import { adaptTaskWithAI, levelsWithAI, readTaskFile } from "./agents/task-adapter";
import type { AgentAttachment } from "./agents/types";
import { adaptByRules, isAdaptOption, levelsByRules, normalizeAdapted, type AdaptedContent, type LevelKey, type TaskKind } from "./task-adaptation";
import { loadPlanningFor, contentOf, latestVersion } from "./dua/shared";

export type TaskScope = { studentId: string } | { planningId: string };
export type TaskText = { title: string; text: string };

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

async function authorize(user: SessionUser, scope: TaskScope): Promise<{ redaction: RedactionScope; studentId: string | null }> {
  if ("studentId" in scope) {
    await assertStudentTeam(user, scope.studentId);
    return { redaction: { student: scope.studentId }, studentId: scope.studentId };
  }
  const { planning } = await loadPlanningFor(user, scope.planningId, "edit");
  return { redaction: { school: planning.schoolId }, studentId: null };
}

async function attachmentOf(file: File): Promise<AgentAttachment> {
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  if (file.type === "application/pdf") return { kind: "pdf", data };
  if (IMAGE_TYPES.has(file.type)) return { kind: "image", mediaType: file.type as "image/jpeg", data };
  throw new UserError("Envie uma foto (JPG, PNG ou WebP) ou um PDF.");
}

const READ_UNAVAILABLE = {
  desligada: "A leitura de foto ou PDF precisa do Claude configurado nesta instalação. Cole o texto da atividade.",
  sem_autorizacao: "Ler foto ou PDF usa IA, e a família deste estudante ainda não autorizou. Cole o texto da atividade.",
  falhou: "Não foi possível ler o arquivo agora. Tente de novo ou cole o texto da atividade.",
};

export async function transcribeTask(user: SessionUser, scope: TaskScope, file: File): Promise<TaskText> {
  const { redaction, studentId } = await authorize(user, scope);
  const attachment = await attachmentOf(file);
  const { value, reason } = await runAiJob<TaskText>({
    task: "leitura de foto ou PDF",
    scope: redaction,
    student: studentId,
    needs: "files",
    run: async (model) => {
      const result = await readTaskFile(model, attachment);
      return { title: result.title.trim(), text: result.text.trim() };
    },
  });
  if (!value) throw new UserError(READ_UNAVAILABLE[reason ?? "falhou"]);
  if (studentId) await recordChange(user, studentId, AUDIT_ACTION.sentToAi, "Foto ou PDF de atividade da turma, para transcrever (Claude)");
  if (!value.text) throw new UserError("Não deu para ler texto no arquivo. Tente uma foto mais nítida ou cole o texto.");
  return value;
}

function taskText(input: TaskText): TaskText {
  const text = input.text.trim();
  if (text.length < 10) throw new UserError("Cole o texto da atividade (ou envie a foto ou o PDF).");
  return { title: input.title.trim() || "Atividade da turma", text };
}

export type AdaptInput = TaskText & { kind: TaskKind; options: string[]; objectiveId: string | null };

export async function createAdaptedTask(user: SessionUser, studentId: string, request: AdaptInput) {
  const prisma = await db();
  await authorize(user, { studentId });
  const input = { ...request, ...taskText(request) };
  const options = input.options.filter(isAdaptOption);
  const objective = input.objectiveId
    ? await prisma.objective.findFirst({ where: { id: input.objectiveId, plan: { studentId, status: "ativo" } }, select: { id: true, description: true, bnccCode: true } })
    : null;
  const { value: content, source } = await runAiJob({
    task: "adaptação de atividade",
    scope: { student: studentId },
    student: studentId,
    run: async (model) => {
      const profile = await prisma.functionalProfile.findUnique({ where: { studentId } });
      const adapted = await adaptTaskWithAI(model, { ...input, options, profile: profile ? profileText(profile) : "Perfil ainda não registrado.", objective: objective?.description ?? null });
      if (!adapted.items.length) throw new Error("sem questões");
      return adapted;
    },
    rules: () => adaptByRules(input, options),
  });
  if (source === "ia") await recordChange(user, studentId, AUDIT_ACTION.sentToAi, `Atividade da turma para adaptar: ${input.title.slice(0, 80)} (sem nome do estudante)`);
  const task = await prisma.adaptedTask.create({
    data: {
      studentId, kind: input.kind, title: content.title, sourceText: input.text.slice(0, 20000), options: JSON.stringify(options),
      content: JSON.stringify(content), source, objectiveId: objective?.id ?? null, bnccCode: validBnccCode(objective?.bnccCode),
      createdById: user.id, createdByName: user.name,
    },
  });
  refreshTasks({ studentId });
  return task;
}

function refreshTasks(scope: TaskScope) {
  if ("studentId" in scope) invalidateStudent(scope.studentId);
  else revalidatePath(`/planejamento/${scope.planningId}/niveis`);
}

export const taskContent = (stored: string, title: string): AdaptedContent => normalizeAdapted(JSON.parse(stored) as Partial<AdaptedContent>, title);

async function draftTask(user: SessionUser, scope: TaskScope, taskId: string) {
  const prisma = await db();
  await authorize(user, scope);
  const task = await prisma.adaptedTask.findFirst({ where: { id: taskId, ...scope } });
  if (!task) throw new UserError("Atividade adaptada não encontrada.", "not_found");
  if (task.status === "aprovada") throw new UserError("Atividade aprovada não muda mais. Faça uma nova adaptação.", "conflict");
  return task;
}

export async function saveAdaptedTask(user: SessionUser, scope: TaskScope, taskId: string, content: Partial<AdaptedContent>, approve: boolean) {
  const prisma = await db();
  const task = await draftTask(user, scope, taskId);
  const clean = normalizeAdapted(content, task.title);
  await prisma.adaptedTask.update({
    where: { id: task.id },
    data: { content: JSON.stringify(clean), title: clean.title, ...(approve ? { status: "aprovada", approvedBy: user.name, approvedAt: new Date() } : {}) },
  });
  if (approve && task.studentId) await recordChange(user, task.studentId, AUDIT_ACTION.approved, `Atividade adaptada: ${clean.title.slice(0, 80)}`);
  refreshTasks(scope);
}

export async function deleteAdaptedTask(user: SessionUser, scope: TaskScope, taskId: string) {
  const prisma = await db();
  const task = await draftTask(user, scope, taskId);
  await prisma.adaptedTask.delete({ where: { id: task.id } });
  if (task.studentId) await recordChange(user, task.studentId, AUDIT_ACTION.deleted, `Atividade adaptada: ${task.title.slice(0, 80)}`);
  refreshTasks(scope);
}

export async function createLevels(user: SessionUser, planningId: string, request: TaskText & { kind: TaskKind }) {
  const prisma = await db();
  const { planning } = await loadPlanningFor(user, planningId, "edit");
  const input = { ...request, ...taskText(request) };
  const content = contentOf(await latestVersion(planningId));
  const objective = content.objective.learning.trim() || "Objetivo não informado no planejamento.";
  const { value: levels, source } = await runAiJob({
    task: "níveis da atividade",
    scope: { school: planning.schoolId },
    run: async (model) => {
      const result = await levelsWithAI(model, { title: input.title, text: input.text, objective });
      if (!result.padrao.items.length) throw new Error("sem questões");
      return result;
    },
    rules: () => levelsByRules(adaptByRules(input, [])),
  });
  const batchId = randomUUID();
  const bnccCode = content.objective.bnccCodes[0] ?? null;
  await prisma.$transaction((["mais_apoio", "padrao", "desafio"] as LevelKey[]).map((level) => prisma.adaptedTask.create({
    data: {
      planningId, level, batchId, kind: input.kind, title: levels[level].title || input.title, sourceText: input.text.slice(0, 20000),
      content: JSON.stringify(levels[level]), source, bnccCode, createdById: user.id, createdByName: user.name,
    },
  })));
  refreshTasks({ planningId });
  return batchId;
}
