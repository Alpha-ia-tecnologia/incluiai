import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import type { SessionUser } from "./auth";
import { recordChange } from "./access-log";
import { aiAllowedFor } from "./consent";
import { hasApiKey } from "./env";
import { validBnccCode } from "./bncc";
import { createAgentModel, isAIEnabled } from "./agents/model";
import { createAnonymizer, loadAnonymizer, nameTokens, type Anonymizer } from "./agents/anonymize";
import { profileText } from "./agents/context";
import { adaptTaskWithAI, levelsWithAI, readTaskFile } from "./agents/task-adapter";
import type { AgentAttachment } from "./agents/types";
import { adaptByRules, isAdaptOption, levelsByRules, normalizeAdapted, type AdaptedContent, type LevelKey, type TaskKind } from "./task-adaptation";
import { loadPlanningFor, contentOf, latestVersion } from "./dua/shared";

// Atividade ou prova da turma adaptada (item 1) e a mesma atividade em três
// níveis no DUA (item 5). O arquivo enviado só passa pela IA para ser
// transcrito: não fica guardado. Regras puras em task-adaptation.ts.

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

async function transcribe(file: File, anonymizerFor: () => Promise<Anonymizer>): Promise<ReadResult> {
  // Só o Claude lê imagem e PDF.
  if (!hasApiKey("ANTHROPIC_API_KEY")) return { error: "A leitura de foto ou PDF precisa do Claude configurado nesta instalação. Cole o texto da atividade." };
  const attachment = await attachmentOf(file);
  if (typeof attachment === "string") return { error: attachment };
  try {
    const { model } = createAgentModel(await anonymizerFor());
    const result = await readTaskFile(model, attachment);
    return result.text.trim() ? { title: result.title.trim(), text: result.text.trim() } : { error: "Não deu para ler texto no arquivo. Tente uma foto mais nítida ou cole o texto." };
  } catch {
    return { error: "Não foi possível ler o arquivo agora. Tente de novo ou cole o texto da atividade." };
  }
}

// Foto ou PDF da atividade, para um estudante: só com a autorização da família para IA.
export async function readTaskForStudent(user: SessionUser, studentId: string, file: File): Promise<ReadResult> {
  if (!(await aiAllowedFor(studentId))) return { error: "Ler foto ou PDF usa IA, e a família deste estudante ainda não autorizou. Cole o texto da atividade." };
  const result = await transcribe(file, () => loadAnonymizer(studentId));
  if (!("error" in result)) await recordChange(user, studentId, "enviou à IA", "Foto ou PDF de atividade da turma, para transcrever (Claude)");
  return result;
}

export type AdaptInput = { title: string; text: string; kind: TaskKind; options: string[]; objectiveId: string | null };

export async function createAdaptedTask(user: SessionUser, studentId: string, input: AdaptInput) {
  const options = input.options.filter(isAdaptOption);
  const objective = input.objectiveId
    ? await prisma.objective.findFirst({ where: { id: input.objectiveId, plan: { studentId, status: "ativo" } }, select: { id: true, description: true, bnccCode: true } })
    : null;
  let content: AdaptedContent;
  let source: "ia" | "regras" = "regras";
  if (await aiAllowedFor(studentId)) {
    try {
      const profile = await prisma.functionalProfile.findUnique({ where: { studentId } });
      const { model } = createAgentModel(await loadAnonymizer(studentId));
      content = await adaptTaskWithAI(model, { ...input, options, profile: profile ? profileText(profile) : "Perfil ainda não registrado.", objective: objective?.description ?? null });
      if (!content.items.length) throw new Error("sem questões");
      source = "ia";
      await recordChange(user, studentId, "enviou à IA", `Atividade da turma para adaptar: ${input.title.slice(0, 80)} (sem nome do estudante)`);
    } catch {
      content = adaptByRules(input, options);
    }
  } else {
    content = adaptByRules(input, options);
  }
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
  const task = await prisma.adaptedTask.findFirst({ where });
  if (!task) throw new Error("Atividade adaptada não encontrada.");
  if (task.status === "aprovada") throw new Error("Atividade aprovada não muda mais. Faça uma nova adaptação.");
  return task;
}

// Ajustes do professor no texto adaptado (rascunho).
export async function saveAdaptedContent(where: { id: string; studentId?: string; planningId?: string }, content: AdaptedContent) {
  const task = await draftTask(where);
  const clean = normalizeAdapted(content, task.title);
  await prisma.adaptedTask.update({ where: { id: task.id }, data: { content: JSON.stringify(clean), title: clean.title } });
}

export async function approveAdaptedTask(user: SessionUser, where: { id: string; studentId?: string; planningId?: string }) {
  const task = await draftTask(where);
  await prisma.adaptedTask.update({ where: { id: task.id }, data: { status: "aprovada", approvedBy: user.name, approvedAt: new Date() } });
  if (task.studentId) await recordChange(user, task.studentId, "aprovou", `Atividade adaptada: ${task.title.slice(0, 80)}`);
}

export async function deleteAdaptedTask(where: { id: string; studentId?: string; planningId?: string }) {
  const task = await draftTask(where);
  await prisma.adaptedTask.delete({ where: { id: task.id } });
}

// ------------------------------------------------------------ DUA: três níveis

// Planejamento coletivo: saem os nomes de estudantes, responsáveis, profissionais
// e escolas do recorte (mesma regra das sugestões do DUA).
async function planningAnonymizer(schoolId: string | null): Promise<Anonymizer> {
  const [students, users, schools] = await Promise.all([
    prisma.student.findMany({ where: schoolId ? { schoolId } : {}, select: { name: true, guardianName: true } }),
    prisma.user.findMany({ select: { name: true } }),
    prisma.school.findMany({ select: { name: true } }),
  ]);
  const parts = (list: string[]) => list.filter(Boolean).flatMap((name) => [name, ...nameTokens(name)]);
  return createAnonymizer({
    student: "",
    classmates: parts(students.map((item) => item.name)),
    family: parts(students.map((item) => item.guardianName)),
    professionals: parts(users.map((item) => item.name)),
    schools: schools.map((item) => item.name),
  });
}

// Foto ou PDF da atividade da turma no DUA: planejamento coletivo, sem dado de
// estudante; vale a mesma regra das sugestões do DUA (IA configurada).
export async function readTaskForPlanning(user: SessionUser, planningId: string, file: File): Promise<ReadResult> {
  const { planning } = await loadPlanningFor(user, planningId, "edit");
  if (!isAIEnabled()) return { error: "A leitura de foto ou PDF usa IA, que está desligada nesta instalação. Cole o texto da atividade." };
  return transcribe(file, () => planningAnonymizer(planning.schoolId));
}

export async function createLevels(user: SessionUser, planningId: string, input: { title: string; text: string; kind: TaskKind }) {
  const { planning } = await loadPlanningFor(user, planningId, "edit");
  const content = contentOf(await latestVersion(planningId));
  const objective = content.objective.learning.trim() || "Objetivo não informado no planejamento.";
  const base = adaptByRules(input, []);
  let levels: Record<LevelKey, AdaptedContent> = levelsByRules(base);
  let source: "ia" | "regras" = "regras";
  if (isAIEnabled()) {
    try {
      const { model } = createAgentModel(await planningAnonymizer(planning.schoolId));
      const result = await levelsWithAI(model, { title: input.title, text: input.text, objective });
      if (result.padrao.items.length) { levels = result; source = "ia"; }
    } catch {
      // As regras já deram as três versões.
    }
  }
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
