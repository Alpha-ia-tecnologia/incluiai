"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { homeActivityNote } from "@/lib/user-journey";
import { saveDiaryEntry, saveFamilyNote } from "@/lib/records";

// Registro em 3 toques (itens 5 e 17.6): participação + apoio + critério.
// Ao registrar sobre uma atividade aceita, ela passa a "aplicada" — fechando
// o ciclo sugerir → decidir → aplicar → registrar.
export async function createDiaryEntry(studentId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Faça login para registrar a aula.");
  await saveDiaryEntry(user, studentId, {
    objectiveId: String(formData.get("objectiveId") ?? "") || null,
    activityId: String(formData.get("activityId") ?? "") || null,
    participation: (String(formData.get("participation") ?? "parcial") as "total" | "parcial" | "recusou"),
    supportLevel: Number(formData.get("supportLevel") ?? 2),
    criterionMet: (String(formData.get("criterionMet") ?? "parcial") as "sim" | "parcial" | "nao"),
    note: String(formData.get("note") ?? ""),
    whatWorked: String(formData.get("whatWorked") ?? ""),
    recommendation: String(formData.get("recommendation") ?? ""),
    authorRole: String(formData.get("authorRole") ?? "professor_sala"),
  });

  revalidatePath("/estudantes/[id]", "layout");
  revalidatePath("/estudantes");
  revalidatePath("/");
  revalidatePath(`/estudantes/${studentId}`);
}

// A família avisa que fez em casa uma atividade enviada pela escola. Vira uma
// observação da família, que a equipe vê no resumo do estudante.
export async function markHomeActivityDone(activityId: string) {
  const user = await getCurrentUser();
  const activity = await prisma.activity.findUnique({ where: { id: activityId }, select: { studentId: true, title: true, context: true, status: true } });
  if (!user || !activity || user.role !== "familia" || user.studentId !== activity.studentId || activity.context !== "casa" || !["aceita", "aplicada"].includes(activity.status)) {
    throw new Error("Você não tem permissão para esta ação.");
  }
  await prisma.familyNote.create({ data: { studentId: activity.studentId, note: homeActivityNote(activity.title), author: "Família" } });
  revalidatePath(`/familia/${activity.studentId}`);
  revalidatePath(`/estudantes/${activity.studentId}`);
  revalidatePath("/jornada");
}

export async function createFamilyNote(studentId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Faça login para registrar a conquista.");
  const note = String(formData.get("note") ?? "").trim();
  if (!note) return;
  await saveFamilyNote(user, studentId, note, String(formData.get("author") ?? "Família"));
  revalidatePath(`/familia/${studentId}`);
  revalidatePath(`/estudantes/${studentId}`);
}

