"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { getCurrentUser, type SessionUser } from "@/lib/auth";
import { DuaError } from "@/lib/dua/shared";
import { DUA_PRINCIPLES, type DuaContent, type DuaPrinciple } from "@/lib/dua/domain";
import { createPlanning, openNewVersion, returnToDraft, saveDraft, setCollaborators, setSharing, submitForReview, validateVersion, type SaveResult } from "@/lib/dua/plannings";
import { addStudentVoice, createSupport, removeStudentVoice, updateSupport, validateSupport } from "@/lib/dua/supports";
import { createApplication, registerEvidence, updateApplication } from "@/lib/dua/applications";
import { createMaterial, validateMaterial } from "@/lib/dua/materials";
import { decideBlock, requestSuggestion } from "@/lib/dua/suggestions";
import { saveAeeSession } from "@/lib/aee-sessions";
import { studentInReach, loadPlanningFor } from "@/lib/dua/shared";

// Ações do planejamento com DUA. Cada uma confere a sessão e delega à camada de
// dados (src/lib/dua), que confere a permissão no planejamento e o recorte do
// estudante. Toda entrada é validada aqui: o que vem da tela não é confiável.
// Os erros voltam como resultado (não como exceção) para a mensagem chegar à
// pessoa também no build de produção.

export type DuaResult<T = undefined> =
  | { ok: true; value: T }
  | { ok: false; message: string; problems?: { field: string; message: string }[]; kind?: string };

const FALLBACK = "Não foi possível concluir agora. Tente de novo em instantes.";

async function run<T>(work: (user: SessionUser) => Promise<T>): Promise<DuaResult<T>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sua sessão terminou. Entre de novo para continuar.", kind: "sem_sessao" };
  try {
    return { ok: true, value: await work(user) };
  } catch (error) {
    if (error instanceof DuaError) return { ok: false, message: error.message, problems: error.problems, kind: error.kind };
    if (error instanceof z.ZodError) return { ok: false, message: "Alguns campos vieram em formato inesperado. Atualize a página e tente de novo.", kind: "invalido" };
    // Mensagens das regras compartilhadas (records, aee-sessions) já são para a pessoa.
    if (error instanceof Error && /permissão|Informe|Escolha|Diga|registrad|estudo de caso/i.test(error.message)) return { ok: false, message: error.message };
    console.error("[dua] ação falhou:", error);
    return { ok: false, message: FALLBACK };
  }
}

const id = z.string().trim().min(1).max(64);
const text = (max: number) => z.string().max(max * 2).default("");
const intNumber = z.coerce.number().int().min(0).max(100_000);

const refreshPlanning = (planningId: string) => {
  revalidatePath(`/planejamento/${planningId}`, "layout");
  revalidatePath("/planejamento");
};
const refreshStudent = (studentId: string) => revalidatePath(`/estudantes/${studentId}`, "layout");

// ------------------------------------------------------------------ planejamento

export async function createDuaPlanning(input: { title: string; className?: string; reuseFromId?: string }): Promise<DuaResult<{ id: string }>> {
  return run(async (user) => {
    const data = z.object({ title: text(160), className: text(80).optional(), reuseFromId: id.optional() }).parse(input);
    const planningId = await createPlanning(user, data);
    revalidatePath("/planejamento");
    return { id: planningId };
  });
}

// Salvamento automático do rascunho: sem revalidar a página (o editor mantém o próprio estado).
export async function saveDuaDraft(input: { planningId: string; version: number; revision: number; content: DuaContent }): Promise<DuaResult<SaveResult>> {
  return run(async (user) => {
    const data = z.object({ planningId: id, version: intNumber, revision: intNumber, content: z.record(z.string(), z.unknown()) }).parse(input);
    return saveDraft(user, data.planningId, { version: data.version, revision: data.revision, content: data.content as Partial<DuaContent> });
  });
}

const versionRef = z.object({ planningId: id, version: intNumber, revision: intNumber });

export async function submitDuaForReview(input: { planningId: string; version: number; revision: number }): Promise<DuaResult> {
  return run(async (user) => {
    const data = versionRef.parse(input);
    await submitForReview(user, data.planningId, data.version, data.revision);
    refreshPlanning(data.planningId);
    return undefined;
  });
}

export async function returnDuaToDraft(input: { planningId: string; version: number; revision: number }): Promise<DuaResult> {
  return run(async (user) => {
    const data = versionRef.parse(input);
    await returnToDraft(user, data.planningId, data.version, data.revision);
    refreshPlanning(data.planningId);
    return undefined;
  });
}

export async function validateDuaVersion(input: { planningId: string; version: number; revision: number }): Promise<DuaResult> {
  return run(async (user) => {
    const data = versionRef.parse(input);
    await validateVersion(user, data.planningId, data.version, data.revision);
    refreshPlanning(data.planningId);
    return undefined;
  });
}

export async function openDuaNewVersion(input: { planningId: string }): Promise<DuaResult<{ version: number }>> {
  return run(async (user) => {
    const data = z.object({ planningId: id }).parse(input);
    const version = await openNewVersion(user, data.planningId);
    refreshPlanning(data.planningId);
    return { version };
  });
}

export async function setDuaSharing(input: { planningId: string; sharing: "privado" | "compartilhado" }): Promise<DuaResult> {
  return run(async (user) => {
    const data = z.object({ planningId: id, sharing: z.enum(["privado", "compartilhado"]) }).parse(input);
    await setSharing(user, data.planningId, data.sharing);
    refreshPlanning(data.planningId);
    return undefined;
  });
}

export async function setDuaCollaborators(input: { planningId: string; userIds: string[] }): Promise<DuaResult> {
  return run(async (user) => {
    const data = z.object({ planningId: id, userIds: z.array(id).max(30) }).parse(input);
    await setCollaborators(user, data.planningId, data.userIds);
    refreshPlanning(data.planningId);
    return undefined;
  });
}

// ------------------------------------------------------------------ sugestões

export async function requestDuaSuggestion(input: { planningId: string; purpose: "opcoes" | "apoio_individual"; supportId?: string; profileFields?: string[]; requestId: string }): Promise<DuaResult<{ id: string }>> {
  return run(async (user) => {
    const data = z.object({ planningId: id, purpose: z.enum(["opcoes", "apoio_individual"]), supportId: id.optional(), profileFields: z.array(z.string().max(80)).max(40).optional(), requestId: id }).parse(input);
    const suggestionId = await requestSuggestion(user, data.planningId, data);
    refreshPlanning(data.planningId);
    return { id: suggestionId };
  });
}

export async function decideDuaBlock(input: { planningId: string; suggestionId: string; blockId: string; decision: "aceito" | "editado" | "recusado"; strategy?: string; principles?: DuaPrinciple[]; includeCriterion?: boolean; reason?: string; confirmStale?: boolean }): Promise<DuaResult> {
  return run(async (user) => {
    const data = z.object({
      planningId: id, suggestionId: id, blockId: id, decision: z.enum(["aceito", "editado", "recusado"]),
      strategy: text(1200).optional(), principles: z.array(z.enum(DUA_PRINCIPLES as unknown as [DuaPrinciple, ...DuaPrinciple[]])).max(3).optional(),
      includeCriterion: z.boolean().optional(), reason: text(600).optional(), confirmStale: z.boolean().optional(),
    }).parse(input);
    await decideBlock(user, data.suggestionId, data.blockId, data);
    refreshPlanning(data.planningId);
    return undefined;
  });
}

// ------------------------------------------------------------------ apoios individuais

const supportFields = {
  barrierDescription: text(600), barrierStatus: z.string().max(20).default("prevista"), support: text(1200), purpose: text(600), usageContext: text(300),
  profileFields: z.array(z.string().max(80)).max(40).default([]), objectiveIds: z.array(id).max(20).default([]),
  individualObjectiveText: text(600), individualObjectiveJustification: text(600), individualObjectiveId: z.string().max(64).default(""),
};
export type DuaSupportFormInput = { [K in keyof typeof supportFields]?: z.input<(typeof supportFields)[K]> };

export async function createDuaSupport(input: { planningId: string; studentId: string } & DuaSupportFormInput): Promise<DuaResult<{ id: string }>> {
  return run(async (user) => {
    const data = z.object({ planningId: id, studentId: id, ...supportFields }).parse(input);
    const supportId = await createSupport(user, data.planningId, data.studentId, data);
    refreshPlanning(data.planningId);
    refreshStudent(data.studentId);
    return { id: supportId };
  });
}

export async function updateDuaSupport(input: { planningId: string; studentId: string; supportId: string; revision: number } & DuaSupportFormInput): Promise<DuaResult> {
  return run(async (user) => {
    const data = z.object({ planningId: id, studentId: id, supportId: id, revision: intNumber, ...supportFields }).parse(input);
    await updateSupport(user, data.supportId, data.revision, data);
    refreshPlanning(data.planningId);
    refreshStudent(data.studentId);
    return undefined;
  });
}

export async function validateDuaSupport(input: { planningId: string; studentId: string; supportId: string; revision: number }): Promise<DuaResult> {
  return run(async (user) => {
    const data = z.object({ planningId: id, studentId: id, supportId: id, revision: intNumber }).parse(input);
    await validateSupport(user, data.supportId, data.revision);
    refreshPlanning(data.planningId);
    refreshStudent(data.studentId);
    return undefined;
  });
}

export async function addDuaStudentVoice(input: { planningId: string; studentId: string; supportId: string; kind: string; text: string; context: string; origin: string; date: string }): Promise<DuaResult> {
  return run(async (user) => {
    const data = z.object({ planningId: id, studentId: id, supportId: id, kind: z.enum(["interesse", "recurso_util", "forma_escolhida", "dificuldade", "avaliacao"]), text: text(600), context: text(300), origin: z.enum(["estudante", "familia", "profissional"]), date: z.string().max(10) }).parse(input);
    await addStudentVoice(user, data.supportId, data);
    refreshPlanning(data.planningId);
    refreshStudent(data.studentId);
    return undefined;
  });
}

export async function removeDuaStudentVoice(input: { planningId: string; studentId: string; supportId: string; entryId: string }): Promise<DuaResult> {
  return run(async (user) => {
    const data = z.object({ planningId: id, studentId: id, supportId: id, entryId: id }).parse(input);
    await removeStudentVoice(user, data.supportId, data.entryId);
    refreshPlanning(data.planningId);
    refreshStudent(data.studentId);
    return undefined;
  });
}

// Entrada pelo estudante (RF01): escolher uma atividade existente ou começar uma nova.
// As duas levam ao MESMO planejamento, nos apoios individuais, com o estudante escolhido.
export async function startStudentParticipation(input: { studentId: string; planningId?: string; title?: string }): Promise<DuaResult<{ planningId: string }>> {
  return run(async (user) => {
    const data = z.object({ studentId: id, planningId: id.optional(), title: text(160).optional() }).parse(input);
    await studentInReach(user, data.studentId);
    if (data.planningId) {
      await loadPlanningFor(user, data.planningId, "read");
      return { planningId: data.planningId };
    }
    const planningId = await createPlanning(user, { title: data.title ?? "" });
    revalidatePath("/planejamento");
    return { planningId };
  });
}

// ------------------------------------------------------------------ aplicação e evidências

export async function createDuaApplication(input: { planningId: string; versionNumber: number; context: string; date: string; className?: string; participantIds: string[]; resources?: string; organization?: string; notes?: string }): Promise<DuaResult<{ id: string }>> {
  return run(async (user) => {
    const data = z.object({ planningId: id, versionNumber: intNumber, context: z.string().max(20), date: z.string().max(10), className: text(80), participantIds: z.array(id).max(60).default([]), resources: text(1200), organization: text(1200), notes: text(2000) }).parse(input);
    const applicationId = await createApplication(user, data.planningId, data);
    refreshPlanning(data.planningId);
    return { id: applicationId };
  });
}

export async function updateDuaApplication(input: { planningId: string; applicationId: string; revision: number; state: string; notes?: string; addParticipantIds?: string[]; removeParticipantIds?: string[] }): Promise<DuaResult> {
  return run(async (user) => {
    const data = z.object({ planningId: id, applicationId: id, revision: intNumber, state: z.string().max(20), notes: z.string().max(4000).optional(), addParticipantIds: z.array(id).max(60).default([]), removeParticipantIds: z.array(id).max(60).default([]) }).parse(input);
    await updateApplication(user, data.applicationId, data.revision, data);
    refreshPlanning(data.planningId);
    return undefined;
  });
}

export async function registerDuaEvidence(input: { planningId: string; applicationId: string; studentId: string; date?: string; criteria: Array<{ criterionId: string; status: string }>; optionsOffered?: string[]; participationForm?: string; studentChoice?: string; supportProvided?: string; observedResponse?: string; remainingBarriers?: string; nextStep?: string }): Promise<DuaResult> {
  return run(async (user) => {
    const data = z.object({
      planningId: id, applicationId: id, studentId: id, date: z.string().max(10).default(""),
      criteria: z.array(z.object({ criterionId: id, status: z.string().max(30) })).max(40),
      optionsOffered: z.array(id).max(40).default([]),
      participationForm: text(600), studentChoice: text(600), supportProvided: text(600), observedResponse: text(1200), remainingBarriers: text(600), nextStep: text(600),
    }).parse(input);
    await registerEvidence(user, data.applicationId, data.studentId, data);
    refreshPlanning(data.planningId);
    refreshStudent(data.studentId);
    return undefined;
  });
}

// ------------------------------------------------------------------ materiais

export async function createDuaMaterial(input: { planningId: string; versionNumber: number; format: string; purpose: string; scope: string; supportId?: string; resourceId?: string }): Promise<DuaResult<{ id: string }>> {
  return run(async (user) => {
    const data = z.object({ planningId: id, versionNumber: intNumber, format: z.string().max(40), purpose: text(600), scope: z.enum(["coletivo", "individual"]), supportId: z.string().max(64).default(""), resourceId: z.string().max(64).default("") }).parse(input);
    const materialId = await createMaterial(user, data.planningId, data);
    refreshPlanning(data.planningId);
    return { id: materialId };
  });
}

export async function validateDuaMaterial(input: { planningId: string; materialId: string; revision: number }): Promise<DuaResult> {
  return run(async (user) => {
    const data = z.object({ planningId: id, materialId: id, revision: intNumber }).parse(input);
    await validateMaterial(user, data.materialId, data.revision);
    refreshPlanning(data.planningId);
    return undefined;
  });
}

// ------------------------------------------------------------------ frequência do AEE

export async function saveAeeSessionAction(input: { studentId: string; date: string; status: string; reason?: string; note?: string }): Promise<DuaResult> {
  return run(async (user) => {
    const data = z.object({ studentId: id, date: z.string().max(10), status: z.string().max(20), reason: text(300), note: text(1200) }).parse(input);
    await saveAeeSession(user, data.studentId, data);
    refreshStudent(data.studentId);
    return undefined;
  });
}
