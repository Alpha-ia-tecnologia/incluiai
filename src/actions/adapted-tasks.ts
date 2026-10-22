"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, requireStudentTeam } from "@/lib/auth";
import { approveAdaptedTask, createAdaptedTask, createLevels, deleteAdaptedTask, readTaskForPlanning, readTaskForStudent, saveAdaptedContent } from "@/lib/adapted-tasks";
import { loadPlanningFor } from "@/lib/dua/shared";
import { ANSWER_FORMATS, type AdaptedContent, type AnswerFormat, type TaskKind } from "@/lib/task-adaptation";

// Adaptar a atividade ou a prova da turma (estudante) e os três níveis (DUA).
// Com arquivo, o primeiro passo só transcreve: o professor confere o texto antes.

// No passo "conferir", as escolhas do primeiro envio voltam para o formulário não se apagar.
export type AdaptState = { error?: string; step?: "conferir"; title?: string; text?: string; saved?: boolean; kind?: TaskKind; options?: string[]; objectiveId?: string };

const kindOf = (value: FormDataEntryValue | null): TaskKind => (value === "prova" ? "prova" : "atividade");
const fileOf = (formData: FormData) => {
  const file = formData.get("file");
  return file instanceof File && file.size ? file : null;
};

export async function adaptForStudent(studentId: string, _previous: AdaptState, formData: FormData): Promise<AdaptState> {
  const user = await requireStudentTeam(studentId);
  const title = String(formData.get("title") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  const file = fileOf(formData);
  if (formData.get("intent") !== "adaptar" && file) {
    const read = await readTaskForStudent(user, studentId, file);
    if ("error" in read) return { error: read.error };
    return { step: "conferir", title: title || read.title, text: read.text, kind: kindOf(formData.get("kind")), options: formData.getAll("options").map(String), objectiveId: String(formData.get("objectiveId") ?? "") };
  }
  if (text.length < 10) return { error: "Cole o texto da atividade (ou envie a foto ou o PDF)." };
  const task = await createAdaptedTask(user, studentId, {
    title: title || "Atividade da turma", text, kind: kindOf(formData.get("kind")),
    options: formData.getAll("options").map(String), objectiveId: String(formData.get("objectiveId") ?? "") || null,
  });
  revalidatePath(`/estudantes/${studentId}/atividades`);
  redirect(`/estudantes/${studentId}/atividades/adaptadas/${task.id}`);
}

// O conteúdo editado vem campo a campo (item-0-prompt, item-0-options…).
function contentFrom(formData: FormData): AdaptedContent {
  const lines = (name: string) => String(formData.get(name) ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
  const count = Number(formData.get("itemCount") ?? 0);
  return {
    title: String(formData.get("title") ?? ""),
    instructions: lines("instructions"),
    items: Array.from({ length: Math.min(count, 40) }, (_, index) => {
      const format = String(formData.get(`item-${index}-format`) ?? "escrever");
      return {
        number: index + 1,
        prompt: String(formData.get(`item-${index}-prompt`) ?? ""),
        answerFormat: (ANSWER_FORMATS.includes(format as AnswerFormat) ? format : "escrever") as AnswerFormat,
        options: lines(`item-${index}-options`),
        support: String(formData.get(`item-${index}-support`) ?? ""),
      };
    }),
    teacherNotes: lines("teacherNotes"),
    preserved: String(formData.get("preserved") ?? ""),
  };
}

export async function saveStudentTask(studentId: string, taskId: string, _previous: AdaptState, formData: FormData): Promise<AdaptState> {
  const user = await requireStudentTeam(studentId);
  try {
    await saveAdaptedContent({ id: taskId, studentId }, contentFrom(formData));
    if (formData.get("intent") === "aprovar") await approveAdaptedTask(user, { id: taskId, studentId });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível salvar." };
  }
  revalidatePath(`/estudantes/${studentId}/atividades/adaptadas/${taskId}`);
  revalidatePath(`/estudantes/${studentId}/atividades`);
  return { saved: true };
}

export async function removeStudentTask(studentId: string, taskId: string): Promise<void> {
  await requireStudentTeam(studentId);
  await deleteAdaptedTask({ id: taskId, studentId });
  revalidatePath(`/estudantes/${studentId}/atividades`);
  redirect(`/estudantes/${studentId}/atividades`);
}

async function planner(planningId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await loadPlanningFor(user, planningId, "edit");
  return user;
}

export async function makeLevels(planningId: string, _previous: AdaptState, formData: FormData): Promise<AdaptState> {
  const user = await planner(planningId);
  const title = String(formData.get("title") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  const file = fileOf(formData);
  if (formData.get("intent") !== "adaptar" && file) {
    const read = await readTaskForPlanning(user, planningId, file);
    if ("error" in read) return { error: read.error };
    return { step: "conferir", title: title || read.title, text: read.text, kind: kindOf(formData.get("kind")) };
  }
  if (text.length < 10) return { error: "Cole o texto da atividade da turma (ou envie a foto ou o PDF)." };
  const batchId = await createLevels(user, planningId, { title: title || "Atividade da turma", text, kind: kindOf(formData.get("kind")) });
  revalidatePath(`/planejamento/${planningId}/niveis`);
  redirect(`/planejamento/${planningId}/niveis?lote=${batchId}`);
}

export async function saveLevelTask(planningId: string, taskId: string, _previous: AdaptState, formData: FormData): Promise<AdaptState> {
  const user = await planner(planningId);
  try {
    await saveAdaptedContent({ id: taskId, planningId }, contentFrom(formData));
    if (formData.get("intent") === "aprovar") await approveAdaptedTask(user, { id: taskId, planningId });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível salvar." };
  }
  revalidatePath(`/planejamento/${planningId}/niveis`);
  return { saved: true };
}
