import { revalidatePath } from "next/cache";
import { notifyFamily, notifyTeam } from "./notifications";
import { db } from "./prisma";
import { assertStudentTeam, type SessionUser } from "./auth";
import { canAccessStudent, isFamilyActivity, isFamilyOf, isTherapistOf } from "./policy";
import { can, isLinkedRole } from "./roles";
import { CASE_STUDY_REQUIRED_MESSAGE, isCaseStudyConcluded } from "./case-study";
import { nextReviewProblem, reviewOnTime } from "./plan-lifecycle";
import { AUDIT_ACTION, auditEntry, recordChange } from "./audit";
import { invalidateStudent } from "./invalidate";
import { studentConsent } from "./consent";
import { UserError } from "./user-error";
import { CRITERION_MET, OBJECTIVE_STATUS, PARTICIPATION } from "./scale";
import { validBnccCode } from "./bncc";
import { buildObjectiveDescription } from "./objective";
import { homeActivityNote } from "./user-journey";
import { PlanProposalSchema } from "./agents/schemas";
import type { PlanDocuments } from "./plan-documents";
import type { ProfileData } from "./functional-profile";

export async function assertCaseStudyConcluded(studentId: string) {
  const prisma = await db();
  const caseStudy = await prisma.caseStudy.findUnique({ where: { studentId }, select: { status: true } });
  if (!isCaseStudyConcluded(caseStudy)) throw new UserError(CASE_STUDY_REQUIRED_MESSAGE, "conflict");
}

export type DiaryEntryInput = {
  objectiveId?: string | null;
  activityId?: string | null;
  participation: string;
  supportLevel: number;
  criterionMet: string;
  note?: string | null;
  whatWorked?: string | null;
  recommendation?: string | null;
  authorRole: string;
};

export async function saveDiaryEntry(user: SessionUser, studentId: string, input: DiaryEntryInput) {
  const prisma = await db();
  await assertStudentTeam(user, studentId);
  const supportLevel = Math.round(Number(input.supportLevel));
  if (!Object.hasOwn(PARTICIPATION, input.participation) || !Object.hasOwn(CRITERION_MET, input.criterionMet) || !(supportLevel >= 0 && supportLevel <= 5)) {
    throw new UserError("Marque a participação, o apoio e o resultado.");
  }
  const objectiveId = input.objectiveId || null;
  const activityId = input.activityId || null;
  if (objectiveId) {
    const objective = await prisma.objective.findFirst({ where: { id: objectiveId, plan: { studentId } }, select: { id: true } });
    if (!objective) throw new UserError("Objetivo não encontrado para este estudante.", "not_found");
  }
  if (activityId) {
    const activity = await prisma.activity.findFirst({ where: { id: activityId, studentId }, select: { id: true } });
    if (!activity) throw new UserError("Atividade não encontrada para este estudante.", "not_found");
  }
  const authorRole = input.authorRole.trim().slice(0, 60);
  if (!authorRole || isLinkedRole(authorRole)) throw new UserError("Escolha o seu papel neste registro.");
  const entry = await prisma.diaryEntry.create({
    data: {
      studentId,
      objectiveId,
      activityId,
      participation: input.participation,
      supportLevel,
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
  await recordChange(user, studentId, AUDIT_ACTION.recorded, "Registro de aula");
  invalidateStudent(studentId);
  return entry;
}

export async function saveProfile(user: SessionUser, studentId: string, profile: ProfileData) {
  const prisma = await db();
  await assertStudentTeam(user, studentId);
  await prisma.functionalProfile.upsert({ where: { studentId }, create: { studentId, ...profile }, update: profile });
  await recordChange(user, studentId, AUDIT_ACTION.edited, "Perfil funcional");
  invalidateStudent(studentId);
}

export async function saveFamilyNote(user: SessionUser, studentId: string, note: string, author: string) {
  const prisma = await db();
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, schoolId: true } });
  if (!student || !canAccessStudent(user, student) || !(can(user.role, "pedagogical") || can(user.role, "familyPortal"))) {
    throw new UserError("Você não tem permissão para registrar observações deste estudante.", "forbidden");
  }
  const text = note.trim();
  if (!text) throw new UserError("Escreva o que aconteceu.");
  const saved = await prisma.familyNote.create({ data: { studentId, note: text, author: author.trim() || "Família" } });
  invalidateStudent(studentId);
  return saved;
}

export async function recordHomeActivity(user: SessionUser, activityId: string) {
  const prisma = await db();
  const activity = await prisma.activity.findUnique({ where: { id: activityId }, select: { studentId: true, title: true, context: true, status: true } });
  if (!activity || !isFamilyOf(user, activity.studentId) || !isFamilyActivity(activity)) {
    throw new UserError("Você não tem permissão para esta ação.", "forbidden");
  }
  await prisma.familyNote.create({ data: { studentId: activity.studentId, note: homeActivityNote(activity.title), author: "Família" } });
  invalidateStudent(activity.studentId);
  revalidatePath("/jornada");
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
  const prisma = await db();
  if (!isTherapistOf(user, studentId)) {
    throw new UserError("Só o terapeuta vinculado ao estudante pode enviar orientações.", "forbidden");
  }
  if (!(await studentConsent(studentId)).therapistLink) throw new UserError("A família ainda não autorizou a conexão com o terapeuta.", "forbidden");
  const report = await prisma.intersectorReport.create({
    data: { studentId, authorName: user.name, ...input, positioning: input.positioning?.trim() || null },
  });
  await prisma.timelineEvent.create({
    data: { studentId, type: "atendimento", title: "Relatório de Articulação Intersetorial", description: `Registrado por ${user.name} (rede de saúde).` },
  });
  await recordChange(user, studentId, AUDIT_ACTION.created, "Relatório de articulação intersetorial");
  await notifyTeam(studentId, "terapeuta_relatorio", `/estudantes/${studentId}`);
  invalidateStudent(studentId);
  return report;
}

export async function setObjectiveStatus(user: SessionUser, studentId: string, objectiveId: string, status: string) {
  const prisma = await db();
  await assertStudentTeam(user, studentId);
  if (!Object.hasOwn(OBJECTIVE_STATUS, status)) throw new UserError("Situação inválida.");
  const objective = await prisma.objective.findFirst({ where: { id: objectiveId, plan: { studentId } } });
  if (!objective) throw new UserError("Objetivo não encontrado para este estudante.", "not_found");
  await prisma.objective.update({ where: { id: objectiveId }, data: { status } });
  await recordChange(user, studentId, AUDIT_ACTION.changed, `Objetivo: ${OBJECTIVE_STATUS[status]}`);
  if (status === "alcancado") {
    await prisma.timelineEvent.create({ data: { studentId, type: "conquista", title: "Objetivo alcançado", description: objective.description } });
  }
  invalidateStudent(studentId);
  return objective;
}

export async function decideActivity(user: SessionUser, studentId: string, activityId: string, decision: "aceita" | "rejeitada", reason?: string | null) {
  const prisma = await db();
  await assertStudentTeam(user, studentId);
  const activity = await prisma.activity.findFirst({ where: { id: activityId, studentId } });
  if (!activity) throw new UserError("Atividade não encontrada para este estudante.", "not_found");
  const decided = { decidedBy: user.name, decidedAt: new Date() };
  const updated = await prisma.activity.update({
    where: { id: activityId },
    data: decision === "aceita" ? { status: "aceita", rejectReason: null, ...decided } : { status: "rejeitada", rejectReason: reason?.trim() || "Sem motivo informado", ...decided },
  });
  await recordChange(user, studentId, decision === "aceita" ? AUDIT_ACTION.accepted : AUDIT_ACTION.declined, `Atividade: ${activity.title}`);
  invalidateStudent(studentId);
  return updated;
}

const dayAtNoon = (iso: string) => new Date(`${iso}T12:00:00`);

type ObjectiveInput = {
  action: string;
  condition: string;
  criterion: string;
  deadlineWeeks: number;
  currentSupport: number;
  targetSupport: number;
  dimension: string;
  bnccCode?: string | null;
};

const objectiveRow = (studentName: string, objective: ObjectiveInput) => ({
  action: objective.action,
  condition: objective.condition,
  criterion: objective.criterion,
  deadlineWeeks: objective.deadlineWeeks,
  description: buildObjectiveDescription({ studentName, ...objective }),
  bnccCode: validBnccCode(objective.bnccCode),
  dimension: objective.dimension,
  currentSupport: objective.currentSupport,
  targetSupport: objective.targetSupport,
});

type NewPlan = {
  initialSituation: string;
  reviewDate: string;
  documents: PlanDocuments;
  proposalObjectives?: number[];
};

export async function createStudentPlan(user: SessionUser, studentId: string, plan: NewPlan) {
  const prisma = await db();
  const student = await assertStudentTeam(user, studentId);
  await assertCaseStudyConcluded(studentId);
  const active = await prisma.plan.findFirst({ where: { studentId, status: "ativo" }, select: { id: true } });
  if (active) throw new UserError("Já existe um plano ativo para este estudante. Revise ou encerre o plano atual antes de criar outro.", "conflict");
  const initialSituation = plan.initialSituation.trim();
  if (!initialSituation) throw new UserError("Informe o que o estudante já consegue fazer.");
  const reviewDate = dayAtNoon(plan.reviewDate);
  if (Number.isNaN(reviewDate.getTime())) throw new UserError("Informe quando a equipe vai revisar o plano.");
  const draft = plan.proposalObjectives ? await prisma.planDraft.findUnique({ where: { studentId } }) : null;
  if (plan.proposalObjectives && !draft) throw new UserError("A proposta não foi encontrada. Gere uma nova proposta.", "not_found");
  const proposal = draft ? PlanProposalSchema.parse(JSON.parse(draft.content)) : null;
  const objectives = proposal ? (plan.proposalObjectives ?? []).map((index) => proposal.objectives[index]).filter(Boolean) : [];

  await prisma.plan.create({
    data: {
      studentId,
      status: "ativo",
      initialSituation,
      ...plan.documents,
      reviewDate,
      objectives: { create: objectives.map((objective) => objectiveRow(student.name, objective)) },
    },
  });
  if (draft) await prisma.planDraft.delete({ where: { studentId } });
  await prisma.timelineEvent.create({
    data: {
      studentId,
      type: "plano",
      title: "PAEE e PEI elaborados",
      description: draft
        ? `Plano criado a partir de proposta ${draft.source === "ia" ? "dos agentes de IA" : "do motor de regras"}, revisada pela equipe, com ${objectives.length} objetivo(s).`
        : "Plano de ensino criado a partir do estudo de caso.",
    },
  });
  await recordChange(user, studentId, AUDIT_ACTION.created, draft ? "Plano individual (a partir de proposta)" : "Plano individual (preenchido pela equipe)");
  invalidateStudent(studentId);
}

export async function discardPlanProposal(user: SessionUser, studentId: string) {
  const prisma = await db();
  await assertStudentTeam(user, studentId);
  await prisma.planDraft.deleteMany({ where: { studentId } });
  await recordChange(user, studentId, AUDIT_ACTION.edited, "Proposta de plano descartada");
  invalidateStudent(studentId);
}

export async function addPlanObjective(user: SessionUser, studentId: string, planId: string, objective: ObjectiveInput) {
  const prisma = await db();
  const student = await assertStudentTeam(user, studentId);
  const plan = await prisma.plan.findFirst({ where: { id: planId, studentId }, select: { id: true } });
  if (!plan) throw new UserError("Plano não encontrado para este estudante.", "not_found");
  if (!objective.action || !objective.condition || !objective.criterion) {
    throw new UserError("Ação, condição e critério são obrigatórios para um objetivo observável.");
  }
  if (objective.bnccCode && !validBnccCode(objective.bnccCode)) throw new UserError("Código da BNCC não encontrado. Escolha a habilidade pela busca.");
  await prisma.objective.create({ data: { planId, ...objectiveRow(student.name, objective) } });
  await recordChange(user, studentId, AUDIT_ACTION.created, "Objetivo do plano de ensino");
  invalidateStudent(studentId);
}

// Planos anteriores à orientação do INEP não tinham autoria nem todo o conteúdo mínimo.
export async function savePlanDocuments(user: SessionUser, studentId: string, planId: string, documents: PlanDocuments) {
  const prisma = await db();
  await assertStudentTeam(user, studentId);
  const plan = await prisma.plan.findFirst({ where: { id: planId, studentId, status: "ativo" }, select: { id: true } });
  if (!plan) throw new UserError("Plano ativo não encontrado para este estudante.", "not_found");
  await prisma.plan.update({ where: { id: plan.id }, data: documents });
  await recordChange(user, studentId, AUDIT_ACTION.edited, "PAEE e PEI do plano de ensino");
  invalidateStudent(studentId);
  revalidatePath("/dossie");
}

export async function reviewStudentPlan(user: SessionUser, studentId: string, planId: string, input: { summary: string; nextReviewDate: string }) {
  const prisma = await db();
  await assertStudentTeam(user, studentId);
  const plan = await prisma.plan.findFirst({ where: { id: planId, studentId, status: "ativo" }, select: { id: true, reviewDate: true } });
  if (!plan) throw new UserError("Plano ativo não encontrado para este estudante.", "not_found");
  const summary = input.summary.trim();
  if (!summary) throw new UserError("Conte o que a equipe decidiu na revisão.");
  const nextReviewDate = dayAtNoon(input.nextReviewDate);
  const problem = nextReviewProblem(nextReviewDate);
  if (problem) throw new UserError(problem);
  const now = new Date();
  const onTime = reviewOnTime(now, plan.reviewDate);
  await prisma.$transaction([
    prisma.planReview.create({ data: { planId, reviewedAt: now, dueDate: plan.reviewDate, onTime, summary, nextReviewDate, reviewerName: user.name, reviewerRole: user.role } }),
    prisma.plan.update({ where: { id: planId }, data: { reviewDate: nextReviewDate, reviewedAt: now } }),
    prisma.timelineEvent.create({ data: { studentId, type: "plano", title: "Plano revisado", description: `${onTime ? "Revisão no prazo" : "Revisão fora do prazo"}. ${summary}`.slice(0, 600) } }),
    prisma.accessLog.create({ data: { studentId, ...auditEntry(user, AUDIT_ACTION.reviewed, "Plano individual") } }),
  ]);
  await notifyFamily(studentId, "plano_revisado", `/familia/${studentId}`);
  invalidateStudent(studentId);
}

export async function closeStudentPlan(user: SessionUser, studentId: string, planId: string, reason: string) {
  const prisma = await db();
  await assertStudentTeam(user, studentId);
  const text = reason.trim();
  if (!text) throw new UserError("Diga por que o plano está sendo encerrado.");
  const plan = await prisma.plan.findFirst({ where: { id: planId, studentId, status: "ativo" }, select: { id: true } });
  if (!plan) throw new UserError("Plano ativo não encontrado para este estudante.", "not_found");
  const now = new Date();
  await prisma.$transaction([
    prisma.plan.update({ where: { id: planId }, data: { status: "encerrado", closedAt: now, closedReason: text.slice(0, 300) } }),
    prisma.timelineEvent.create({ data: { studentId, type: "plano", title: "Plano encerrado", description: text.slice(0, 600) } }),
    prisma.accessLog.create({ data: { studentId, ...auditEntry(user, AUDIT_ACTION.closed, "Plano individual") } }),
  ]);
  invalidateStudent(studentId);
}
