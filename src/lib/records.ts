import { prisma } from "./prisma";
import { canAccessStudent, canSeePedagogicalDetail, isStaffOrNetwork, type SessionUser } from "./auth";
import { CASE_STUDY_REQUIRED_MESSAGE, isCaseStudyConcluded } from "./case-study";

// Gravações do acompanhamento usadas pelos formulários e pelo assistente.
// Cada uma confere a permissão de quem grava; nada aqui é ação pública.

export async function assertStudentTeam(user: SessionUser, studentId: string) {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, schoolId: true, name: true } });
  if (!student || !isStaffOrNetwork(user.role) || !canSeePedagogicalDetail(user.role) || !canAccessStudent(user, student.schoolId, student.id)) {
    throw new Error("Você não tem permissão para esta ação com este estudante.");
  }
  return student;
}

// Plano de ensino só com estudo de caso concluído (CA02), em toda criação de plano:
// manual, a partir de proposta e na própria proposta da IA ou das regras.
export async function assertCaseStudyConcluded(studentId: string) {
  const caseStudy = await prisma.caseStudy.findUnique({ where: { studentId }, select: { status: true } });
  if (!isCaseStudyConcluded(caseStudy)) throw new Error(CASE_STUDY_REQUIRED_MESSAGE);
}

export type DiaryEntryInput = {
  objectiveId?: string | null;
  activityId?: string | null;
  participation: "total" | "parcial" | "recusou";
  supportLevel: number;
  criterionMet: "sim" | "parcial" | "nao";
  note?: string | null;
  whatWorked?: string | null;
  recommendation?: string | null;
  authorRole: string;
};

// Registro em 3 toques. Ao registrar sobre uma atividade aceita, ela passa a
// "aplicada", fechando o ciclo sugerir → decidir → aplicar → registrar.
export async function saveDiaryEntry(user: SessionUser, studentId: string, input: DiaryEntryInput) {
  await assertStudentTeam(user, studentId);
  const objectiveId = input.objectiveId || null;
  const activityId = input.activityId || null;
  if (objectiveId) {
    const objective = await prisma.objective.findFirst({ where: { id: objectiveId, plan: { studentId } }, select: { id: true } });
    if (!objective) throw new Error("Objetivo não encontrado para este estudante.");
  }
  if (activityId) {
    const activity = await prisma.activity.findFirst({ where: { id: activityId, studentId }, select: { id: true } });
    if (!activity) throw new Error("Atividade não encontrada para este estudante.");
  }
  const entry = await prisma.diaryEntry.create({
    data: {
      studentId,
      objectiveId,
      activityId,
      participation: input.participation,
      supportLevel: Math.min(5, Math.max(0, Math.round(input.supportLevel))),
      criterionMet: input.criterionMet,
      note: input.note?.trim() || null,
      whatWorked: input.whatWorked?.trim() || null,
      recommendation: input.recommendation?.trim() || null,
      authorRole: input.authorRole,
    },
  });
  if (activityId) {
    await prisma.activity.update({ where: { id: activityId }, data: { status: "aplicada" } });
  }
  return entry;
}

export async function saveFamilyNote(user: SessionUser, studentId: string, note: string, author: string) {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, schoolId: true } });
  if (!student || !canAccessStudent(user, student.schoolId, student.id) || user.role === "terapeuta") {
    throw new Error("Você não tem permissão para registrar observações deste estudante.");
  }
  const text = note.trim();
  if (!text) throw new Error("Escreva o que aconteceu.");
  return prisma.familyNote.create({ data: { studentId, note: text, author: author.trim() || "Família" } });
}

export type IntersectorReportInput = {
  communication: string;
  accessResources: string;
  positioning?: string | null;
  facilitators: string;
  schoolGuidance: string;
  strategiesToTry: string;
  sharedGoals: string;
};

export async function saveIntersectorReport(user: SessionUser, studentId: string, input: IntersectorReportInput) {
  if (user.role !== "terapeuta" || user.studentId !== studentId) {
    throw new Error("Só o terapeuta vinculado ao estudante pode enviar orientações.");
  }
  const report = await prisma.intersectorReport.create({
    data: { studentId, authorName: user.name, ...input, positioning: input.positioning?.trim() || null },
  });
  await prisma.timelineEvent.create({
    data: { studentId, type: "atendimento", title: "Relatório de Articulação Intersetorial", description: `Registrado por ${user.name} (rede de saúde).` },
  });
  await prisma.accessLog.create({
    data: { studentId, actor: user.name, role: "terapeuta", action: "criou", detail: "Relatório de articulação intersetorial" },
  });
  return report;
}

export async function setObjectiveStatus(user: SessionUser, studentId: string, objectiveId: string, status: "ativo" | "alcancado" | "em_revisao") {
  await assertStudentTeam(user, studentId);
  const objective = await prisma.objective.findFirst({ where: { id: objectiveId, plan: { studentId } } });
  if (!objective) throw new Error("Objetivo não encontrado para este estudante.");
  await prisma.objective.update({ where: { id: objectiveId }, data: { status } });
  if (status === "alcancado") {
    await prisma.timelineEvent.create({ data: { studentId, type: "conquista", title: "Objetivo alcançado", description: objective.description } });
  }
  return objective;
}

export async function decideActivity(user: SessionUser, studentId: string, activityId: string, decision: "aceita" | "rejeitada", reason?: string | null) {
  await assertStudentTeam(user, studentId);
  const activity = await prisma.activity.findFirst({ where: { id: activityId, studentId } });
  if (!activity) throw new Error("Atividade não encontrada para este estudante.");
  return prisma.activity.update({
    where: { id: activityId },
    data: decision === "aceita" ? { status: "aceita", rejectReason: null } : { status: "rejeitada", rejectReason: reason?.trim() || "Sem motivo informado" },
  });
}
