import "server-only";
import { prisma } from "../prisma";
import type { SessionUser } from "../auth";
import { formatDate, parseJson } from "../format";
import {
  APPLICATION_CONTEXTS, CRITERION_STATUSES, EXECUTION_STATES, followUpSuggestions, observationOf, resultFromCriteria,
  type ApplicationContext, type CriterionStatus, type DuaContent, type DuaSupportData, type EvidenceObservation, type ExecutionState, type FollowUpSuggestion,
} from "./domain";
import { planningAccess } from "./access";
import { DuaError, audit, canWorkWithStudent, clip, contentOf, dateFromInput, loadPlanningFor, studentInReach, studentLog } from "./shared";

// Aplicação da atividade (RF07): versão usada, turma ou grupo, contexto (sala
// comum ou AEE), data, participantes e situação de execução — separada da
// revisão pedagógica. Concluir uma aplicação NÃO cria presença, atendimento de
// AEE nem conclusão sobre aprendizagem (CA10).

type Person = { id: string; name: string };

export type ApplicationInput = {
  versionNumber: number;
  context: string;
  date: string;
  className: string;
  participantIds: string[];
  resources: string;
  organization: string;
  notes: string;
};

async function participantsInReach(user: SessionUser, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 60);
  const students = await prisma.student.findMany({ where: { id: { in: unique } }, select: { id: true, name: true, schoolId: true } });
  if (students.length !== unique.length || students.some((student) => !canWorkWithStudent(user, student))) {
    throw new DuaError("Há participante fora do seu acesso. Escolha só estudantes que você acompanha.", "sem_permissao");
  }
  return unique;
}

export async function createApplication(user: SessionUser, planningId: string, input: ApplicationInput) {
  const { planning } = await loadPlanningFor(user, planningId, "read");
  const version = await prisma.duaPlanningVersion.findUnique({ where: { planningId_version: { planningId, version: input.versionNumber } } });
  if (!version) throw new DuaError("Versão não encontrada.", "nao_encontrado");
  if (version.state !== "validado") throw new DuaError("Só uma versão validada pode ser aplicada. Valide o planejamento antes.");
  if (!APPLICATION_CONTEXTS.includes(input.context as ApplicationContext)) throw new DuaError("Diga se a aplicação é na sala comum ou no AEE.");
  const date = dateFromInput(input.date, "a data da aplicação");
  const participantIds = await participantsInReach(user, input.participantIds);
  const application = await prisma.duaApplication.create({
    data: {
      planningId,
      versionId: version.id,
      versionNumber: version.version,
      context: input.context,
      schoolId: user.schoolId ?? planning.schoolId,
      className: clip(input.className, 80) || planning.className,
      date,
      responsibles: JSON.stringify([{ id: user.id, name: user.name }]),
      resources: clip(input.resources, 1200) || null,
      organization: clip(input.organization, 1200) || null,
      participantIds: JSON.stringify(participantIds),
      notes: clip(input.notes, 2000) || null,
      createdById: user.id,
      createdByName: user.name,
    },
  });
  await audit(user, planningId, "registrou aplicação", "aplicacao", { objectId: application.id, versionNumber: version.version, detail: `${input.context === "aee" ? "AEE" : "Sala comum"} · ${formatDate(date)}` });
  return application.id;
}

async function loadApplicationFor(user: SessionUser, applicationId: string) {
  const application = await prisma.duaApplication.findUnique({ where: { id: applicationId }, include: { planning: true, version: true } });
  if (!application) throw new DuaError("Aplicação não encontrada.", "nao_encontrado");
  const access = planningAccess(user, application.planning);
  if (!access.read) throw new DuaError("Aplicação não encontrada.", "nao_encontrado");
  const responsible = parseJson<Person[]>(application.responsibles, []).some((person) => person.id === user.id) || application.createdById === user.id;
  return { application, access, canManage: access.edit || responsible };
}

// Situação de execução e participantes. Quem não vê um participante não o remove.
export async function updateApplication(user: SessionUser, applicationId: string, revision: number, input: { state: string; notes: string; addParticipantIds: string[]; removeParticipantIds: string[] }) {
  const { application, canManage } = await loadApplicationFor(user, applicationId);
  if (!canManage) throw new DuaError("Só quem responde pela aplicação ou edita o planejamento altera a aplicação.", "sem_permissao");
  if (!EXECUTION_STATES.includes(input.state as ExecutionState)) throw new DuaError("Situação de execução inválida.");
  const current = parseJson<string[]>(application.participantIds, []);
  const added = await participantsInReach(user, input.addParticipantIds);
  const removable = (await prisma.student.findMany({ where: { id: { in: input.removeParticipantIds } }, select: { id: true, schoolId: true } })).filter((student) => canWorkWithStudent(user, student)).map((student) => student.id);
  const next = [...new Set([...current.filter((id) => !removable.includes(id)), ...added])];
  const updated = await prisma.duaApplication.updateMany({
    where: { id: applicationId, revision },
    data: { state: input.state, notes: clip(input.notes, 2000) || null, participantIds: JSON.stringify(next), revision: { increment: 1 } },
  });
  if (!updated.count) throw new DuaError("Outro profissional alterou esta aplicação agora há pouco. Atualize a página.", "conflito");
  if (input.state !== application.state) await audit(user, application.planningId, "mudou a situação da aplicação", "aplicacao", { objectId: applicationId, versionNumber: application.versionNumber, detail: input.state });
}

export type EvidenceInput = {
  date: string;
  criteria: Array<{ criterionId: string; status: string }>;
  optionsOffered: string[];
  participationForm: string;
  studentChoice: string;
  supportProvided: string;
  observedResponse: string;
  remainingBarriers: string;
  nextStep: string;
};

// Registro rápido depois da atividade. Um registro por estudante e aplicação:
// registrar de novo atualiza (tentativas repetidas não duplicam). Fica na
// memória educacional do estudante, sem criar diário, presença nem atendimento.
export async function registerEvidence(user: SessionUser, applicationId: string, studentId: string, input: EvidenceInput) {
  const { application } = await loadApplicationFor(user, applicationId);
  const student = await studentInReach(user, studentId);
  if (!parseJson<string[]>(application.participantIds, []).includes(studentId)) throw new DuaError("Este estudante não está entre os participantes da aplicação.");
  if (application.state === "cancelada") throw new DuaError("A aplicação foi cancelada: não há evidência a registrar.");
  const content = contentOf(application.version);
  const criterionIds = new Set(content.criteria.map((item) => item.id));
  const given = new Map(input.criteria.filter((item) => criterionIds.has(item.criterionId)).map((item) => [item.criterionId, item.status]));
  const criteria = content.criteria.map((item) => ({ criterionId: item.id, status: (CRITERION_STATUSES.includes(given.get(item.id) as CriterionStatus) ? given.get(item.id) : "nao_registrado") as CriterionStatus }));
  const strategyIds = new Set(content.strategies.map((item) => item.id));
  const support = await prisma.duaSupport.findFirst({ where: { planningId: application.planningId, studentId }, orderBy: { updatedAt: "desc" }, select: { id: true } });
  const data = {
    date: input.date ? dateFromInput(input.date, "a data do registro") : application.date,
    criteria: JSON.stringify(criteria),
    optionsOffered: JSON.stringify([...new Set(input.optionsOffered)].filter((id) => strategyIds.has(id))),
    participationForm: clip(input.participationForm, 600),
    studentChoice: clip(input.studentChoice, 600),
    supportProvided: clip(input.supportProvided, 600),
    observedResponse: clip(input.observedResponse, 1200),
    remainingBarriers: clip(input.remainingBarriers, 600),
    nextStep: clip(input.nextStep, 600),
    observation: observationOf(criteria),
    result: resultFromCriteria(criteria),
    supportId: support?.id ?? null,
    authorId: user.id,
    authorName: user.name,
    authorRole: user.role,
  };
  const existing = await prisma.duaEvidence.findUnique({ where: { applicationId_studentId: { applicationId, studentId } }, select: { id: true } });
  await prisma.duaEvidence.upsert({
    where: { applicationId_studentId: { applicationId, studentId } },
    create: { ...data, planningId: application.planningId, applicationId, studentId, versionNumber: application.versionNumber, context: application.context },
    update: data,
  });
  await audit(user, application.planningId, existing ? "atualizou evidência" : "registrou evidência", "evidencia", { objectId: applicationId, versionNumber: application.versionNumber });
  await studentLog(user, student.id, existing ? "editou" : "criou", `Evidência da atividade com DUA "${application.planning.title}" (${application.context === "aee" ? "AEE" : "sala comum"})`);
}

export type EvidenceView = {
  id: string;
  studentId: string;
  studentName: string;
  date: Date;
  context: ApplicationContext;
  versionNumber: number;
  criteria: Array<{ criterionId: string; description: string; status: CriterionStatus }>;
  optionsOffered: string[];
  participationForm: string;
  studentChoice: string;
  supportProvided: string;
  observedResponse: string;
  remainingBarriers: string;
  nextStep: string;
  observation: EvidenceObservation;
  result: "sim" | "parcial" | "nao" | null;
  authorName: string;
};

const evidenceView = (row: { id: string; studentId: string; date: Date; context: string; versionNumber: number; criteria: string; optionsOffered: string; participationForm: string; studentChoice: string; supportProvided: string; observedResponse: string; remainingBarriers: string; nextStep: string; observation: string; result: string | null; authorName: string; student: { name: string } }, content: DuaContent): EvidenceView => {
  const descriptions = new Map(content.criteria.map((item) => [item.id, item.description]));
  const strategies = new Map(content.strategies.map((item) => [item.id, item.description]));
  return {
    id: row.id,
    studentId: row.studentId,
    studentName: row.student.name,
    date: row.date,
    context: row.context as ApplicationContext,
    versionNumber: row.versionNumber,
    criteria: parseJson<Array<{ criterionId: string; status: CriterionStatus }>>(row.criteria, []).map((item) => ({ ...item, description: descriptions.get(item.criterionId) ?? "Critério da versão aplicada" })),
    optionsOffered: parseJson<string[]>(row.optionsOffered, []).map((id) => strategies.get(id) ?? "").filter(Boolean),
    participationForm: row.participationForm,
    studentChoice: row.studentChoice,
    supportProvided: row.supportProvided,
    observedResponse: row.observedResponse,
    remainingBarriers: row.remainingBarriers,
    nextStep: row.nextStep,
    observation: row.observation as EvidenceObservation,
    result: row.result as EvidenceView["result"],
    authorName: row.authorName,
  };
};

export type ApplicationView = {
  id: string;
  versionNumber: number;
  context: ApplicationContext;
  date: Date;
  className: string | null;
  state: ExecutionState;
  revision: number;
  resources: string | null;
  organization: string | null;
  notes: string | null;
  responsibles: Person[];
  participants: Person[];
  hiddenParticipants: number;
  evidences: EvidenceView[];
  content: DuaContent;
  canManage: boolean;
};

// Aplicações do planejamento: participantes e evidências só dentro do recorte de quem lê.
export async function listApplications(user: SessionUser, planningId: string): Promise<ApplicationView[]> {
  const { access } = await loadPlanningFor(user, planningId, "read");
  const rows = await prisma.duaApplication.findMany({
    where: { planningId },
    include: { version: { select: { content: true } }, evidences: { include: { student: { select: { name: true, schoolId: true, id: true } } } } },
    orderBy: { date: "desc" },
  });
  const allIds = [...new Set(rows.flatMap((row) => parseJson<string[]>(row.participantIds, [])))];
  const students = await prisma.student.findMany({ where: { id: { in: allIds } }, select: { id: true, name: true, schoolId: true } });
  const visible = new Map(students.filter((student) => canWorkWithStudent(user, student)).map((student) => [student.id, student.name]));
  return rows.map((row) => {
    const ids = parseJson<string[]>(row.participantIds, []);
    const responsibles = parseJson<Person[]>(row.responsibles, []);
    const content = contentOf(row.version);
    return {
      id: row.id,
      versionNumber: row.versionNumber,
      context: row.context as ApplicationContext,
      date: row.date,
      className: row.className,
      state: row.state as ExecutionState,
      revision: row.revision,
      resources: row.resources,
      organization: row.organization,
      notes: row.notes,
      responsibles,
      participants: ids.filter((id) => visible.has(id)).map((id) => ({ id, name: visible.get(id)! })),
      hiddenParticipants: ids.filter((id) => !visible.has(id)).length,
      evidences: row.evidences.filter((evidence) => visible.has(evidence.studentId)).map((evidence) => evidenceView(evidence, content)),
      content,
      canManage: access.edit || row.createdById === user.id || responsibles.some((person) => person.id === user.id),
    };
  });
}

export type StudentEvidenceView = EvidenceView & { planningId: string; planningTitle: string; canOpenPlanning: boolean };

// Evidências do estudante em todas as atividades com DUA (memória educacional).
export async function listStudentEvidence(user: SessionUser, studentId: string): Promise<StudentEvidenceView[]> {
  await studentInReach(user, studentId);
  const rows = await prisma.duaEvidence.findMany({
    where: { studentId },
    include: { student: { select: { name: true } }, application: { include: { version: { select: { content: true } }, planning: { select: { id: true, title: true, ownerId: true, schoolId: true, sharing: true, collaborators: true } } } } },
    orderBy: { date: "desc" },
    take: 100,
  });
  return rows.map((row) => ({
    ...evidenceView(row, contentOf(row.application.version)),
    planningId: row.application.planning.id,
    planningTitle: row.application.planning.title,
    canOpenPlanning: planningAccess(user, row.application.planning).read,
  }));
}

// Próximos passos (RF08) a partir das evidências e dos apoios planejados.
// Recomendações para revisão: a decisão e o resultado observado ficam com a equipe.
export async function studentFollowUp(user: SessionUser, studentId: string): Promise<FollowUpSuggestion[]> {
  const [evidence, supports] = await Promise.all([
    listStudentEvidence(user, studentId),
    prisma.duaSupport.findMany({ where: { studentId }, select: { data: true } }),
  ]);
  return followUpSuggestions(
    evidence.slice(0, 10).map((item) => ({ criteria: item.criteria, remainingBarriers: item.remainingBarriers, supportProvided: item.supportProvided, studentChoice: item.studentChoice, date: formatDate(item.date), activity: item.planningTitle })),
    supports.map((row) => ({ support: parseJson<DuaSupportData>(row.data, null as never)?.support ?? "" })).filter((item) => item.support),
  );
}

