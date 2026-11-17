"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isFamilyActivity, isFamilyOf } from "@/lib/policy";
import { homeActivityNote } from "@/lib/user-journey";
import { saveDiaryEntry, saveFamilyNote } from "@/lib/records";

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
    authorRole: String(formData.get("authorRole") ?? user.role),
  });

  revalidatePath("/estudantes/[id]", "layout");
  revalidatePath("/estudantes");
  revalidatePath("/");
  revalidatePath(`/estudantes/${studentId}`);
}

export async function markHomeActivityDone(activityId: string) {
  const prisma = await db();
  const user = await getCurrentUser();
  const activity = await prisma.activity.findUnique({ where: { id: activityId }, select: { studentId: true, title: true, context: true, status: true } });
  if (!user || !activity || !isFamilyOf(user, activity.studentId) || !isFamilyActivity(activity)) {
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

