"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { assertStudentTeam } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/lib/server-action";
import { DUA_PRINCIPLES, type DuaContent, type DuaPrinciple } from "@/lib/dua/domain";
import { createPlanning, openNewVersion, returnToDraft, saveDraft, setCollaborators, setSharing, submitForReview, validateVersion, type SaveResult } from "@/lib/dua/plannings";
import { addStudentVoice, createSupport, removeStudentVoice, updateSupport, validateSupport } from "@/lib/dua/supports";
import { createApplication, registerEvidence, updateApplication } from "@/lib/dua/applications";
import { createMaterial, validateMaterial } from "@/lib/dua/materials";
import { decideBlock, requestSuggestion } from "@/lib/dua/suggestions";
import { loadPlanningFor } from "@/lib/dua/shared";

const id = z.string().trim().min(1).max(64);
const text = (max: number) => z.string().max(max * 2).default("");
const intNumber = z.number().int().min(0).max(100_000);

const refreshPlanning = (planningId: string) => {
  revalidatePath(`/planejamento/${planningId}`, "layout");
  revalidatePath("/planejamento");
};
const refreshStudent = (studentId: string) => revalidatePath(`/estudantes/${studentId}`, "layout");

const newPlanning = z.object({ title: text(160), className: text(80).optional(), reuseFromId: id.optional() });
export async function createDuaPlanning(input: z.input<typeof newPlanning>): Promise<ActionResult<{ id: string }>> {
  return runAction(async (user) => {
    const planningId = await createPlanning(user, newPlanning.parse(input));
    revalidatePath("/planejamento");
    return { id: planningId };
  });
}

const draft = z.object({ planningId: id, version: intNumber, revision: intNumber, content: z.record(z.string(), z.unknown()) });
export async function saveDuaDraft(input: z.input<typeof draft>): Promise<ActionResult<SaveResult>> {
  return runAction(async (user) => {
    const data = draft.parse(input);
    return saveDraft(user, data.planningId, { version: data.version, revision: data.revision, content: data.content as Partial<DuaContent> });
  });
}

const versionRef = z.object({ planningId: id, version: intNumber, revision: intNumber });
type VersionRef = z.input<typeof versionRef>;

export async function submitDuaForReview(input: VersionRef): Promise<ActionResult> {
  return runAction(async (user) => {
    const data = versionRef.parse(input);
    await submitForReview(user, data.planningId, data.version, data.revision);
    refreshPlanning(data.planningId);
  });
}

export async function returnDuaToDraft(input: VersionRef): Promise<ActionResult> {
  return runAction(async (user) => {
    const data = versionRef.parse(input);
    await returnToDraft(user, data.planningId, data.version, data.revision);
    refreshPlanning(data.planningId);
  });
}

export async function validateDuaVersion(input: VersionRef): Promise<ActionResult> {
  return runAction(async (user) => {
    const data = versionRef.parse(input);
    await validateVersion(user, data.planningId, data.version, data.revision);
    refreshPlanning(data.planningId);
  });
}

const planningRef = z.object({ planningId: id });
export async function openDuaNewVersion(input: z.input<typeof planningRef>): Promise<ActionResult<{ version: number }>> {
  return runAction(async (user) => {
    const data = planningRef.parse(input);
    const version = await openNewVersion(user, data.planningId);
    refreshPlanning(data.planningId);
    return { version };
  });
}

const sharing = z.object({ planningId: id, sharing: z.enum(["privado", "compartilhado"]) });
export async function setDuaSharing(input: z.input<typeof sharing>): Promise<ActionResult> {
  return runAction(async (user) => {
    const data = sharing.parse(input);
    await setSharing(user, data.planningId, data.sharing);
    refreshPlanning(data.planningId);
  });
}

const collaborators = z.object({ planningId: id, userIds: z.array(id).max(30) });
export async function setDuaCollaborators(input: z.input<typeof collaborators>): Promise<ActionResult> {
  return runAction(async (user) => {
    const data = collaborators.parse(input);
    await setCollaborators(user, data.planningId, data.userIds);
    refreshPlanning(data.planningId);
  });
}

const suggestionRequest = z.object({ planningId: id, purpose: z.enum(["opcoes", "apoio_individual"]), supportId: id.optional(), profileFields: z.array(z.string().max(80)).max(40).optional(), requestId: id });
export async function requestDuaSuggestion(input: z.input<typeof suggestionRequest>): Promise<ActionResult<{ id: string }>> {
  return runAction(async (user) => {
    const data = suggestionRequest.parse(input);
    const suggestionId = await requestSuggestion(user, data.planningId, data);
    refreshPlanning(data.planningId);
    return { id: suggestionId };
  });
}

const blockDecision = z.object({
  planningId: id, suggestionId: id, blockId: id, decision: z.enum(["aceito", "editado", "recusado"]),
  strategy: text(1200).optional(), principles: z.array(z.enum(DUA_PRINCIPLES as unknown as [DuaPrinciple, ...DuaPrinciple[]])).max(3).optional(),
  includeCriterion: z.boolean().optional(), reason: text(600).optional(), confirmStale: z.boolean().optional(),
});
export async function decideDuaBlock(input: z.input<typeof blockDecision>): Promise<ActionResult> {
  return runAction(async (user) => {
    const data = blockDecision.parse(input);
    await decideBlock(user, data.suggestionId, data.blockId, data);
    refreshPlanning(data.planningId);
  });
}

const supportFields = {
  barrierDescription: text(600), barrierStatus: z.string().max(20).default("prevista"), support: text(1200), purpose: text(600), usageContext: text(300),
  profileFields: z.array(z.string().max(80)).max(40).default([]), objectiveIds: z.array(id).max(20).default([]),
  individualObjectiveText: text(600), individualObjectiveJustification: text(600), individualObjectiveId: z.string().max(64).default(""),
};

const newSupport = z.object({ planningId: id, studentId: id, ...supportFields });
export async function createDuaSupport(input: z.input<typeof newSupport>): Promise<ActionResult<{ id: string }>> {
  return runAction(async (user) => {
    const data = newSupport.parse(input);
    const supportId = await createSupport(user, data.planningId, data.studentId, data);
    refreshPlanning(data.planningId);
    refreshStudent(data.studentId);
    return { id: supportId };
  });
}

const supportRef = z.object({ planningId: id, studentId: id, supportId: id, revision: intNumber });

const supportUpdate = supportRef.extend(supportFields);
export async function updateDuaSupport(input: z.input<typeof supportUpdate>): Promise<ActionResult> {
  return runAction(async (user) => {
    const data = supportUpdate.parse(input);
    await updateSupport(user, data.supportId, data.revision, data);
    refreshPlanning(data.planningId);
    refreshStudent(data.studentId);
  });
}

export async function validateDuaSupport(input: z.input<typeof supportRef>): Promise<ActionResult> {
  return runAction(async (user) => {
    const data = supportRef.parse(input);
    await validateSupport(user, data.supportId, data.revision);
    refreshPlanning(data.planningId);
    refreshStudent(data.studentId);
  });
}

const studentVoice = z.object({ planningId: id, studentId: id, supportId: id, kind: z.enum(["interesse", "recurso_util", "forma_escolhida", "dificuldade", "avaliacao"]), text: text(600), context: text(300), origin: z.enum(["estudante", "familia", "profissional"]), date: z.string().max(10) });
export async function addDuaStudentVoice(input: z.input<typeof studentVoice>): Promise<ActionResult> {
  return runAction(async (user) => {
    const data = studentVoice.parse(input);
    await addStudentVoice(user, data.supportId, data);
    refreshPlanning(data.planningId);
    refreshStudent(data.studentId);
  });
}

const studentVoiceRef = z.object({ planningId: id, studentId: id, supportId: id, entryId: id });
export async function removeDuaStudentVoice(input: z.input<typeof studentVoiceRef>): Promise<ActionResult> {
  return runAction(async (user) => {
    const data = studentVoiceRef.parse(input);
    await removeStudentVoice(user, data.supportId, data.entryId);
    refreshPlanning(data.planningId);
    refreshStudent(data.studentId);
  });
}

const participationStart = z.object({ studentId: id, planningId: id.optional(), title: text(160).optional() });
export async function startStudentParticipation(input: z.input<typeof participationStart>): Promise<ActionResult<{ planningId: string }>> {
  return runAction(async (user) => {
    const data = participationStart.parse(input);
    await assertStudentTeam(user, data.studentId);
    if (data.planningId) {
      await loadPlanningFor(user, data.planningId, "read");
      return { planningId: data.planningId };
    }
    const planningId = await createPlanning(user, { title: data.title ?? "" });
    revalidatePath("/planejamento");
    return { planningId };
  });
}

const newApplication = z.object({ planningId: id, versionNumber: intNumber, context: z.string().max(20), date: z.string().max(10), className: text(80), participantIds: z.array(id).max(60).default([]), resources: text(1200), organization: text(1200), notes: text(2000) });
export async function createDuaApplication(input: z.input<typeof newApplication>): Promise<ActionResult<{ id: string }>> {
  return runAction(async (user) => {
    const data = newApplication.parse(input);
    const applicationId = await createApplication(user, data.planningId, data);
    refreshPlanning(data.planningId);
    return { id: applicationId };
  });
}

const applicationUpdate = z.object({ planningId: id, applicationId: id, revision: intNumber, state: z.string().max(20), notes: z.string().max(4000).optional(), addParticipantIds: z.array(id).max(60).default([]), removeParticipantIds: z.array(id).max(60).default([]) });
export async function updateDuaApplication(input: z.input<typeof applicationUpdate>): Promise<ActionResult> {
  return runAction(async (user) => {
    const data = applicationUpdate.parse(input);
    await updateApplication(user, data.applicationId, data.revision, data);
    refreshPlanning(data.planningId);
  });
}

const evidence = z.object({
  planningId: id, applicationId: id, studentId: id, date: z.string().max(10).default(""),
  criteria: z.array(z.object({ criterionId: id, status: z.string().max(30) })).max(40),
  optionsOffered: z.array(id).max(40).default([]),
  participationForm: text(600), studentChoice: text(600), supportProvided: text(600), observedResponse: text(1200), remainingBarriers: text(600), nextStep: text(600),
});
export async function registerDuaEvidence(input: z.input<typeof evidence>): Promise<ActionResult> {
  return runAction(async (user) => {
    const data = evidence.parse(input);
    await registerEvidence(user, data.applicationId, data.studentId, data);
    refreshPlanning(data.planningId);
    refreshStudent(data.studentId);
  });
}

const newMaterial = z.object({ planningId: id, versionNumber: intNumber, format: z.string().max(40), purpose: text(600), scope: z.enum(["coletivo", "individual"]), supportId: z.string().max(64).default(""), resourceId: z.string().max(64).default("") });
export async function createDuaMaterial(input: z.input<typeof newMaterial>): Promise<ActionResult<{ id: string }>> {
  return runAction(async (user) => {
    const data = newMaterial.parse(input);
    const materialId = await createMaterial(user, data.planningId, data);
    refreshPlanning(data.planningId);
    return { id: materialId };
  });
}

const materialRef = z.object({ planningId: id, materialId: id, revision: intNumber });
export async function validateDuaMaterial(input: z.input<typeof materialRef>): Promise<ActionResult> {
  return runAction(async (user) => {
    const data = materialRef.parse(input);
    await validateMaterial(user, data.materialId, data.revision);
    refreshPlanning(data.planningId);
  });
}
