"use server";

import { imagesAllowedFor } from "@/lib/consent";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { getCurrentUser, requireStudentTeam } from "@/lib/auth";
import { canAccessSchool } from "@/lib/policy";
import { can } from "@/lib/roles";
import { decideActivity } from "@/lib/records";
import { buildActivityCards, saveSuggestedActivities } from "@/lib/agents/generate";
import { createActivityImage } from "@/lib/images/save";

export async function generateActivities(studentId: string, formData: FormData) {
  const prisma = await db();
  const user = await requireStudentTeam(studentId);
  const objectiveId = String(formData.get("objectiveId") ?? "");
  const lessonTopic = String(formData.get("lessonTopic") ?? "").trim();

  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId } });
  const profile = await prisma.functionalProfile.findUnique({ where: { studentId } });
  const objective = await prisma.objective.findUniqueOrThrow({ where: { id: objectiveId }, include: { plan: { select: { studentId: true } } } });
  if (objective.plan.studentId !== studentId) throw new Error("Objetivo de outro estudante.");

  if (!profile) {
    throw new Error("Preencha o perfil funcional antes de gerar atividades.");
  }

  const cards = await buildActivityCards({ student, profile, objective, lessonTopic });
  const created = await saveSuggestedActivities(studentId, objectiveId, cards);

  if (formData.get("gerarImagens") === "on" && (await imagesAllowedFor(studentId))) {
    const results = await Promise.allSettled(created.map((activity) => createActivityImage(activity.id, "sequencia", user)));
    for (const result of results) {
      if (result.status === "rejected") console.error("[imagens] falha ao gerar imagem da atividade:", result.reason);
    }
  }

  revalidatePath("/estudantes/[id]", "layout");
  revalidatePath("/estudantes");
  revalidatePath("/");
}

export async function acceptActivity(studentId: string, activityId: string) {
  const user = await requireStudentTeam(studentId);
  await decideActivity(user, studentId, activityId, "aceita");
  revalidatePath("/estudantes/[id]", "layout");
  revalidatePath("/estudantes");
  revalidatePath("/");
}

export async function rejectActivity(studentId: string, activityId: string, formData: FormData) {
  const user = await requireStudentTeam(studentId);
  await decideActivity(user, studentId, activityId, "rejeitada", String(formData.get("reason") ?? ""));
  revalidatePath("/estudantes/[id]", "layout");
  revalidatePath("/estudantes");
  revalidatePath("/");
}

export async function generateBatchForClass(formData: FormData) {
  const prisma = await db();
  const [schoolId, className] = String(formData.get("turma") ?? "").split("|");
  const lessonTopic = String(formData.get("lessonTopic") ?? "").trim();
  if (!schoolId || !className) throw new Error("Selecione a turma.");
  const user = await getCurrentUser();
  if (!user || !can(user.role, "editRecord") || !canAccessSchool(user, schoolId)) {
    throw new Error("Você não tem permissão para planejar com esta turma.");
  }

  const students = await prisma.student.findMany({
    where: { schoolId, className, status: "ativo" },
    include: {
      profile: true,
      plans: { where: { status: "ativo" }, include: { objectives: { where: { status: "ativo" }, take: 1 } } },
    },
  });

  let count = 0;
  for (const student of students) {
    const profile = student.profile;
    const objective = student.plans[0]?.objectives[0];
    if (!profile || !objective) continue;

    const cards = await buildActivityCards({ student, profile, objective, lessonTopic });
    await saveSuggestedActivities(student.id, objective.id, cards);
    count++;
  }

  revalidatePath("/estudantes");
  revalidatePath("/estudantes/[id]", "layout");
  revalidatePath("/");
  redirect(`/estudantes?lote=${count}`);
}

