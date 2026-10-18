"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canAccessStudent, getCurrentUser, isStaffOrNetwork, requireStudentTeam } from "@/lib/auth";
import { decideActivity } from "@/lib/records";
import { buildActivityCards, saveSuggestedActivities } from "@/lib/agents/generate";
import { isImageGenerationEnabled } from "@/lib/images/openai-images";
import { createActivityImage } from "@/lib/images/save";

// Gera 3 cartões (sala comum / AEE / casa) e salva como "sugerida".
// A IA nunca fecha o ciclo: cartões nascem pendentes de decisão do professor.
export async function generateActivities(studentId: string, formData: FormData) {
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

  // Imagens de apoio opcionais, em paralelo; uma falha não impede as atividades.
  if (formData.get("gerarImagens") === "on" && isImageGenerationEnabled()) {
    const results = await Promise.allSettled(created.map((activity) => createActivityImage(activity.id, "sequencia", user)));
    for (const result of results) {
      if (result.status === "rejected") console.error("[imagens] falha ao gerar imagem da atividade:", result.reason);
    }
  }

  revalidatePath("/estudantes/[id]", "layout");
  revalidatePath("/estudantes");
  revalidatePath("/");
}

// Aceitar e recusar passam pelo mesmo registro do assistente: quem decidiu fica
// na atividade e no histórico de acessos.
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

// Geração em lote para a turma (item 17.8): gera 3 cartões para cada estudante
// da turma que tenha perfil e ao menos um objetivo ativo, usando um mesmo
// conteúdo de aula. Nada é aplicado sem decisão — tudo entra como "sugerida".
export async function generateBatchForClass(formData: FormData) {
  const [schoolId, className] = String(formData.get("turma") ?? "").split("|");
  const lessonTopic = String(formData.get("lessonTopic") ?? "").trim();
  if (!schoolId || !className) throw new Error("Selecione a turma.");
  const user = await getCurrentUser();
  if (!user || !isStaffOrNetwork(user.role) || !canAccessStudent(user, schoolId, "")) {
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

