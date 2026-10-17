"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { buildObjectiveDescription } from "@/lib/objective";
import { getCurrentUser } from "@/lib/auth";
import { setObjectiveStatus } from "@/lib/records";

export async function createPlan(studentId: string, formData: FormData) {
  await prisma.plan.create({
    data: {
      studentId,
      status: "ativo",
      initialSituation: String(formData.get("initialSituation") ?? "").trim(),
      commonRoomStrategies: String(formData.get("commonRoomStrategies") ?? "").trim() || null,
      aeeStrategies: String(formData.get("aeeStrategies") ?? "").trim() || null,
      accessibilityResources: String(formData.get("accessibilityResources") ?? "").trim() || null,
      reviewDate: new Date(String(formData.get("reviewDate"))),
    },
  });
  await prisma.timelineEvent.create({
    data: { studentId, type: "plano", title: "PPI elaborado", description: "Plano individual de acompanhamento criado." },
  });
  revalidatePath("/estudantes/[id]", "layout");
  revalidatePath("/estudantes");
  revalidatePath("/");
}

export async function createObjective(studentId: string, planId: string, formData: FormData) {
  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId } });
  const action = String(formData.get("action") ?? "").trim();
  const condition = String(formData.get("condition") ?? "").trim();
  const criterion = String(formData.get("criterion") ?? "").trim();
  const deadlineWeeks = Number(formData.get("deadlineWeeks") ?? 6);
  const currentSupport = Number(formData.get("currentSupport") ?? 2);

  if (!action || !condition || !criterion) {
    throw new Error("Ação, condição e critério são obrigatórios para um objetivo observável.");
  }

  const description = buildObjectiveDescription({
    studentName: student.name,
    action, condition, criterion, deadlineWeeks, currentSupport,
  });

  await prisma.objective.create({
    data: {
      planId,
      action, condition, criterion, deadlineWeeks, description,
      bnccCode: String(formData.get("bnccCode") ?? "").trim() || null,
      dimension: String(formData.get("dimension") ?? "comunicacao"),
      currentSupport,
      targetSupport: Number(formData.get("targetSupport") ?? Math.max(0, currentSupport - 1)),
    },
  });

  revalidatePath("/estudantes/[id]", "layout");
  revalidatePath("/estudantes");
  revalidatePath("/");
}

export async function markObjectiveStatus(studentId: string, objectiveId: string, status: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Faça login para alterar o objetivo.");
  if (status !== "ativo" && status !== "alcancado" && status !== "em_revisao") throw new Error("Situação inválida.");
  await setObjectiveStatus(user, studentId, objectiveId, status);
  revalidatePath("/estudantes/[id]", "layout");
  revalidatePath("/estudantes");
  revalidatePath("/");
}
