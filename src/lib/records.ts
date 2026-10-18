import { prisma } from "./prisma";
import { canAccessStudent, canEditStudentRecord, type SessionUser } from "./auth";
import { CASE_STUDY_REQUIRED_MESSAGE, isCaseStudyConcluded } from "./case-study";
import { nextReviewProblem, reviewOnTime } from "./plan-lifecycle";
import { recordChange } from "./access-log";

// Gravações do acompanhamento usadas pelos formulários e pelo assistente.
// Cada uma confere a permissão de quem grava; nada aqui é ação pública.

export async function assertStudentTeam(user: SessionUser, studentId: string) {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, schoolId: true, name: true } });
  if (!student || !canEditStudentRecord(user.role) || !canAccessStudent(user, student.schoolId, student.id)) {
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
  // O papel é declarado por quem conduziu (pode ser "intérprete de Libras");
  // família e terapeuta não registram aula da escola. O autor real vem da sessão.
  const authorRole = input.authorRole.trim().slice(0, 60);
  if (!authorRole || ["familia", "terapeuta"].includes(authorRole)) throw new Error("Escolha o seu papel neste registro.");
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
      authorRole,
      authorId: user.id,
      authorName: user.name,
    },
  });
  if (activityId) {
    await prisma.activity.update({ where: { id: activityId }, data: { status: "aplicada" } });
  }
  await recordChange(user, studentId, "registrou", "Registro de aula");
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
  await recordChange(user, studentId, "alterou", `Objetivo: ${status === "alcancado" ? "alcançado" : status === "em_revisao" ? "em revisão" : "ativo"}`);
  if (status === "alcancado") {
    await prisma.timelineEvent.create({ data: { studentId, type: "conquista", title: "Objetivo alcançado", description: objective.description } });
  }
  return objective;
}

export async function decideActivity(user: SessionUser, studentId: string, activityId: string, decision: "aceita" | "rejeitada", reason?: string | null) {
  await assertStudentTeam(user, studentId);
  const activity = await prisma.activity.findFirst({ where: { id: activityId, studentId } });
  if (!activity) throw new Error("Atividade não encontrada para este estudante.");
  // Quem decidiu fica na atividade e no histórico de acessos (seção 17.7: a decisão é humana).
  const decided = { decidedBy: user.name, decidedAt: new Date() };
  const updated = await prisma.activity.update({
    where: { id: activityId },
    data: decision === "aceita" ? { status: "aceita", rejectReason: null, ...decided } : { status: "rejeitada", rejectReason: reason?.trim() || "Sem motivo informado", ...decided },
  });
  await recordChange(user, studentId, decision === "aceita" ? "aceitou" : "recusou", `Atividade: ${activity.title}`);
  return updated;
}

// Um plano ativo por vez: para começar outro, a equipe encerra o atual (com
// motivo) e o histórico fica guardado.
export const ACTIVE_PLAN_EXISTS_MESSAGE = "Já existe um plano ativo para este estudante. Revise ou encerre o plano atual antes de criar outro.";
export async function assertNoActivePlan(studentId: string) {
  const active = await prisma.plan.findFirst({ where: { studentId, status: "ativo" }, select: { id: true } });
  if (active) throw new Error(ACTIVE_PLAN_EXISTS_MESSAGE);
}

// Revisão do plano: guarda a decisão da equipe, a data que estava marcada e se
// saiu no prazo; a data de revisão do plano passa a ser a próxima.
export async function reviewStudentPlan(user: SessionUser, studentId: string, planId: string, input: { summary: string; nextReviewDate: Date }) {
  await assertStudentTeam(user, studentId);
  const plan = await prisma.plan.findFirst({ where: { id: planId, studentId, status: "ativo" }, select: { id: true, reviewDate: true } });
  if (!plan) throw new Error("Plano ativo não encontrado para este estudante.");
  const summary = input.summary.trim();
  if (!summary) throw new Error("Conte o que a equipe decidiu na revisão.");
  const problem = nextReviewProblem(input.nextReviewDate);
  if (problem) throw new Error(problem);
  const now = new Date();
  const onTime = reviewOnTime(now, plan.reviewDate);
  await prisma.$transaction([
    prisma.planReview.create({ data: { planId, reviewedAt: now, dueDate: plan.reviewDate, onTime, summary, nextReviewDate: input.nextReviewDate, reviewerName: user.name, reviewerRole: user.role } }),
    prisma.plan.update({ where: { id: planId }, data: { reviewDate: input.nextReviewDate, reviewedAt: now } }),
    prisma.timelineEvent.create({ data: { studentId, type: "plano", title: "Plano revisado", description: `${onTime ? "Revisão no prazo" : "Revisão fora do prazo"}. ${summary}`.slice(0, 600) } }),
    prisma.accessLog.create({ data: { studentId, actor: user.name, role: user.role, action: "revisou", detail: "Plano individual" } }),
  ]);
}

// Encerrar o plano: o plano e as revisões ficam no histórico; os objetivos
// ainda ativos saem do acompanhamento junto com ele.
export async function closeStudentPlan(user: SessionUser, studentId: string, planId: string, reason: string) {
  await assertStudentTeam(user, studentId);
  const text = reason.trim();
  if (!text) throw new Error("Diga por que o plano está sendo encerrado.");
  const plan = await prisma.plan.findFirst({ where: { id: planId, studentId, status: "ativo" }, select: { id: true } });
  if (!plan) throw new Error("Plano ativo não encontrado para este estudante.");
  const now = new Date();
  await prisma.$transaction([
    prisma.plan.update({ where: { id: planId }, data: { status: "encerrado", closedAt: now, closedReason: text.slice(0, 300) } }),
    prisma.timelineEvent.create({ data: { studentId, type: "plano", title: "Plano encerrado", description: text.slice(0, 600) } }),
    prisma.accessLog.create({ data: { studentId, actor: user.name, role: user.role, action: "encerrou", detail: "Plano individual" } }),
  ]);
}
