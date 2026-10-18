"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { buildObjectiveDescription } from "@/lib/objective";
import { getCurrentUser, requireStudentTeam } from "@/lib/auth";
import { assertCaseStudyConcluded, assertNoActivePlan, closeStudentPlan, reviewStudentPlan, setObjectiveStatus } from "@/lib/records";

// Plano de ensino: equipe com acesso ao estudante e estudo de caso concluído (CA02).
export async function createPlan(studentId: string, formData: FormData) {
  const user = await requireStudentTeam(studentId);
  await assertCaseStudyConcluded(studentId);
  await assertNoActivePlan(studentId);
  const reviewDate = new Date(`${String(formData.get("reviewDate") ?? "")}T12:00:00`);
  if (Number.isNaN(reviewDate.getTime())) throw new Error("Informe quando a equipe vai revisar o plano.");
  await prisma.plan.create({
    data: {
      studentId,
      status: "ativo",
      initialSituation: String(formData.get("initialSituation") ?? "").trim(),
      commonRoomStrategies: String(formData.get("commonRoomStrategies") ?? "").trim() || null,
      aeeStrategies: String(formData.get("aeeStrategies") ?? "").trim() || null,
      accessibilityResources: String(formData.get("accessibilityResources") ?? "").trim() || null,
      reviewDate,
    },
  });
  await prisma.timelineEvent.create({
    data: { studentId, type: "plano", title: "PPI elaborado", description: "Plano individual de acompanhamento criado." },
  });
  await prisma.accessLog.create({ data: { studentId, actor: user.name, role: user.role, action: "criou", detail: "Plano individual (preenchido pela equipe)" } });
  revalidatePath("/estudantes/[id]", "layout");
  revalidatePath("/estudantes");
  revalidatePath("/");
}

export async function createObjective(studentId: string, planId: string, formData: FormData) {
  await requireStudentTeam(studentId);
  // O objetivo entra no plano DESTE estudante: nada de vínculo entre pessoas diferentes.
  const plan = await prisma.plan.findFirst({ where: { id: planId, studentId }, select: { id: true } });
  if (!plan) throw new Error("Plano não encontrado para este estudante.");
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

// Revisão do plano com a equipe: decisão, se saiu no prazo e a próxima data.
export async function reviewPlan(studentId: string, planId: string, formData: FormData) {
  const user = await requireStudentTeam(studentId);
  await reviewStudentPlan(user, studentId, planId, {
    summary: String(formData.get("summary") ?? ""),
    nextReviewDate: new Date(`${String(formData.get("nextReviewDate") ?? "")}T12:00:00`),
  });
  revalidatePath("/estudantes/[id]", "layout");
  revalidatePath("/estudantes");
  revalidatePath("/");
}

// Encerrar o plano (com motivo). Depois disso, a equipe pode elaborar um novo.
export async function closePlan(studentId: string, planId: string, formData: FormData) {
  const user = await requireStudentTeam(studentId);
  // O campo de escolha envia o texto final (opção da lista ou o que foi escrito em "Outro").
  await closeStudentPlan(user, studentId, planId, String(formData.get("reason") ?? ""));
  revalidatePath("/estudantes/[id]", "layout");
  revalidatePath("/estudantes");
  revalidatePath("/");
}
