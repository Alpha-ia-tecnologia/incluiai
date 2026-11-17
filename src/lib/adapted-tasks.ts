import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "./prisma";
import type { SessionUser } from "./auth";
import { AUDIT_ACTION, recordChange } from "./audit";
import { validBnccCode } from "./bncc";
import { runAiJob } from "./agents/job";
import type { RedactionScope } from "./agents/names-in-scope";
import { profileText } from "./agents/context";
import { adaptTaskWithAI, levelsWithAI, readTaskFile } from "./agents/task-adapter";
import type { AgentAttachment } from "./agents/types";
import { adaptByRules, isAdaptOption, levelsByRules, normalizeAdapted, type AdaptedContent, type LevelKey, type TaskKind } from "./task-adaptation";
import { loadPlanningFor, contentOf, latestVersion } from "./dua/shared";

export const MAX_TASK_FILE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type ReadResult = { title: string; text: string } | { error: string };

async function attachmentOf(file: File): Promise<AgentAttachment | string> {
  if (file.size > MAX_TASK_FILE_BYTES) return "O arquivo passa de 10 MB. Tire a foto de novo ou divida o PDF.";
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  if (file.type === "application/pdf") return { kind: "pdf", data };
  if (IMAGE_TYPES.has(file.type)) return { kind: "image", mediaType: file.type as "image/jpeg", data };
  return "Envie uma foto (JPG, PNG ou WebP) ou um PDF.";
}

const READ_UNAVAILABLE = {
  desligada: "A leitura de foto ou PDF precisa do Claude configurado nesta instalação. Cole o texto da atividade.",
  sem_autorizacao: "Ler foto ou PDF usa IA, e a família deste estudante ainda não autorizou. Cole o texto da atividade.",
  falhou: "Não foi possível ler o arquivo agora. Tente de novo ou cole o texto da atividade.",
};

async function transcribe(file: File, scope: RedactionScope, student: string | null): Promise<ReadResult> {
  const { value, reason } = await runAiJob<ReadResult>({
    task: "leitura de foto ou PDF",
    scope,
    student,
    needs: "files",
    run: async (model) => {
      const attachment = await attachmentOf(file);
      if (typeof attachment === "string") return { error: attachment };
      const result = await readTaskFile(model, attachment);
      return result.text.trim() ? { title: result.title.trim(), text: result.text.trim() } : { error: "Não deu para ler texto no arquivo. Tente uma foto mais nítida ou cole o texto." };
    },
  });
  return value ?? { error: READ_UNAVAILABLE[reason ?? "falhou"] };
}

export async function readTaskForStudent(user: SessionUser, studentId: string, file: File): Promise<ReadResult> {
  const result = await transcribe(file, { student: studentId }, studentId);
  if (!("error" in result)) await recordChange(user, studentId, AUDIT_ACTION.sentToAi, "Foto ou PDF de atividade da turma, para transcrever (Claude)");
  return result;
}

export type AdaptInput = { title: string; text: string; kind: TaskKind; options: string[]; objectiveId: string | null };

export async function createAdaptedTask(user: SessionUser, studentId: string, input: AdaptInput) {
  const prisma = await db();
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
  return task;
}

export const taskContent = (stored: string, title: string): AdaptedContent => normalizeAdapted(JSON.parse(stored) as Partial<AdaptedContent>, title);

async function draftTask(where: { id: string; studentId?: string; planningId?: string }) {
  const prisma = await db();
  const task = await prisma.adaptedTask.findFirst({ where });
  if (!task) throw new Error("Atividade adaptada não encontrada.");
  if (task.status === "aprovada") throw new Error("Atividade aprovada não muda mais. Faça uma nova adaptação.");
  return task;
}

export async function saveAdaptedContent(where: { id: string; studentId?: string; planningId?: string }, content: AdaptedContent) {
  const prisma = await db();
  const task = await draftTask(where);
  const clean = normalizeAdapted(content, task.title);
  await prisma.adaptedTask.update({ where: { id: task.id }, data: { content: JSON.stringify(clean), title: clean.title } });
}

export async function approveAdaptedTask(user: SessionUser, where: { id: string; studentId?: string; planningId?: string }) {
  const prisma = await db();
  const task = await draftTask(where);
  await prisma.adaptedTask.update({ where: { id: task.id }, data: { status: "aprovada", approvedBy: user.name, approvedAt: new Date() } });
  if (task.studentId) await recordChange(user, task.studentId, AUDIT_ACTION.approved, `Atividade adaptada: ${task.title.slice(0, 80)}`);
}

export async function deleteAdaptedTask(where: { id: string; studentId?: string; planningId?: string }) {
  const prisma = await db();
  const task = await draftTask(where);
  await prisma.adaptedTask.delete({ where: { id: task.id } });
}

export async function readTaskForPlanning(user: SessionUser, planningId: string, file: File): Promise<ReadResult> {
  const { planning } = await loadPlanningFor(user, planningId, "edit");
  return transcribe(file, { school: planning.schoolId }, null);
}

export async function createLevels(user: SessionUser, planningId: string, input: { title: string; text: string; kind: TaskKind }) {
  const prisma = await db();
  const { planning } = await loadPlanningFor(user, planningId, "edit");
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
  return batchId;
}
