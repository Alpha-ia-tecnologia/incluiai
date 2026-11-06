"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildObjectiveDescription } from "@/lib/objective";
import { getCurrentUser, requireStudentTeam } from "@/lib/auth";
import { setObjectiveStatus } from "@/lib/records";
import { withoutSupportCodes } from "@/lib/scale";

const MAX_TEXT = 500;
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim().slice(0, MAX_TEXT);
// Números do formulário dentro da faixa válida; fora dela, o valor padrão.
const bounded = (raw: FormDataEntryValue | null, min: number, max: number, fallback: number) => {
  const value = Number(raw);
  return raw === null || raw === "" || !Number.isFinite(value) ? fallback : Math.min(max, Math.max(min, Math.round(value)));
};
const STATUSES = ["ativo", "alcancado", "em_revisao"] as const;
type ObjectiveStatus = (typeof STATUSES)[number];
const isStatus = (value: string): value is ObjectiveStatus => (STATUSES as readonly string[]).includes(value);

export async function createPlan(studentId: string, formData: FormData) {
  await requireStudentTeam(studentId);
  const reviewDate = new Date(String(formData.get("reviewDate") ?? ""));
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
    data: { studentId, type: "plano", title: "Plano individual criado", description: "Com os objetivos e os apoios combinados pela equipe." },
  });
  revalidatePath("/estudantes/[id]", "layout");
  revalidatePath("/estudantes");
  revalidatePath("/");
}

export async function createObjective(studentId: string, planId: string, formData: FormData) {
  await requireStudentTeam(studentId);
  const [student, plan] = await Promise.all([
    prisma.student.findUniqueOrThrow({ where: { id: studentId } }),
    prisma.plan.findFirst({ where: { id: planId, studentId }, select: { id: true } }),
  ]);
  if (!plan) throw new Error("Plano não encontrado para este estudante.");
  const action = text(formData, "action");
  const condition = text(formData, "condition");
  const criterion = text(formData, "criterion");
  const deadlineWeeks = bounded(formData.get("deadlineWeeks"), 1, 52, 6);
  const currentSupport = bounded(formData.get("currentSupport"), 0, 5, 2);

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
      bnccCode: text(formData, "bnccCode").slice(0, 20) || null,
      dimension: String(formData.get("dimension") ?? "comunicacao"),
      currentSupport,
      targetSupport: bounded(formData.get("targetSupport"), 0, 5, Math.max(0, currentSupport - 1)),
    },
  });

  revalidatePath("/estudantes/[id]", "layout");
  revalidatePath("/estudantes");
  revalidatePath("/");
}

// Muda a situação do objetivo e volta ao plano com a opção de desfazer.
export async function markObjectiveStatus(studentId: string, objectiveId: string, status: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Faça login para alterar o objetivo.");
  if (!isStatus(status)) throw new Error("Situação inválida.");
  const before = await prisma.objective.findFirst({ where: { id: objectiveId, plan: { studentId } }, select: { status: true } });
  await setObjectiveStatus(user, studentId, objectiveId, status);
  revalidatePath("/estudantes/[id]", "layout");
  revalidatePath("/estudantes");
  revalidatePath("/");
  redirect(`/estudantes/${studentId}/ppi?objetivo=${objectiveId}&antes=${before?.status ?? "ativo"}`);
}

// Desfaz a última mudança: volta a situação anterior e, se o objetivo tinha
// sido marcado como alcançado agora há pouco, retira a conquista da linha do tempo.
export async function undoObjectiveStatus(studentId: string, objectiveId: string, previous: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Faça login para alterar o objetivo.");
  if (!isStatus(previous)) throw new Error("Situação inválida.");
  const objective = await prisma.objective.findFirst({ where: { id: objectiveId, plan: { studentId } }, select: { status: true, description: true } });
  if (!objective) throw new Error("Objetivo não encontrado para este estudante.");
  await setObjectiveStatus(user, studentId, objectiveId, previous);
  if (objective.status === "alcancado" && previous !== "alcancado") {
    const event = await prisma.timelineEvent.findFirst({
      where: {
        studentId, type: "conquista", title: "Objetivo alcançado",
        description: { in: [objective.description, withoutSupportCodes(objective.description)] },
        date: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { date: "desc" },
      select: { id: true },
    });
    if (event) await prisma.timelineEvent.delete({ where: { id: event.id } });
  }
  revalidatePath("/estudantes/[id]", "layout");
  revalidatePath("/estudantes");
  revalidatePath("/");
  redirect(`/estudantes/${studentId}/ppi?desfeito=1`);
}
