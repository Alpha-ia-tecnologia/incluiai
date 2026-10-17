import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "../prisma";
import type { SessionUser } from "../auth";
import { parseJson } from "../format";
import { BARRIERS, CHANNELS, supportInfo } from "../scale";
import { CASE_STUDY_FIELDS, parseCaseStudy } from "../case-study";
import {
  BARRIER_STATUSES, STUDENT_VOICE_KINDS, VOICE_ORIGINS, supportProblems,
  type DuaSupportData, type PlanLink, type ProfileRef, type StudentVoiceEntry,
} from "./domain";
import { planningAccess } from "./access";
import { DuaError, STUDENT_FORBIDDEN, audit, canWorkWithStudent, clip, loadPlanningFor, studentInReach, studentLog } from "./shared";

// Apoios individuais (RF04): ligam a atividade às necessidades e potencialidades
// de um estudante. Acesso restrito ao recorte do estudante. Criar o vínculo não
// altera o perfil funcional nem o plano: o profissional atualiza esses registros
// pelo fluxo próprio deles.

const VALIDATORS = new Set(["professor_sala", "professor_aee", "coordenacao", "gestao"]);

// Campos do estudo de caso úteis ao apoio. Diagnóstico, saúde, acompanhamentos
// externos e composição familiar ficam de fora (necessidade de saber).
const CASE_STUDY_REFS = ["barreiras", "potencialidades", "aprendeMelhor", "gostaEscola", "achaDificil", "comoSeSente", "comunicacaoEscola", "recursos"];

const list = (value: string | null | undefined) => parseJson<string[]>(value, []).filter(Boolean).join(", ");

// Itens que o profissional pode escolher como referência, sempre com origem, data e versão.
export async function profileReferences(user: SessionUser, studentId: string): Promise<ProfileRef[]> {
  await studentInReach(user, studentId);
  const [profile, caseStudy] = await Promise.all([
    prisma.functionalProfile.findUnique({ where: { studentId } }),
    prisma.caseStudy.findUnique({ where: { studentId } }),
  ]);
  const refs: ProfileRef[] = [];
  if (profile) {
    const at = profile.updatedAt.toISOString();
    const source = "Como aprende (perfil funcional)";
    const add = (field: string, label: string, value: string) => { if (value.trim()) refs.push({ field: `perfil.${field}`, label, value, source, updatedAt: at, version: `perfil@${at}` }); };
    const sensory = Object.entries(parseJson<Record<string, string>>(profile.sensoryProfile, {})).filter(([, level]) => level && level !== "tipica").map(([sense, level]) => `${sense}: ${level === "hiper" ? "mais sensível" : "menos sensível"}`).join(", ");
    add("expressiveChannel", "Como se expressa", CHANNELS[profile.expressiveChannel] ?? profile.expressiveChannel);
    add("receptiveChannel", "Como compreende melhor", CHANNELS[profile.receptiveChannel] ?? profile.receptiveChannel);
    add("commandSteps", "Instruções que compreende", `${profile.commandSteps} etapa(s) por vez`);
    add("attentionMinutes", "Tempo de atenção na tarefa", `${profile.attentionMinutes} minutos`);
    add("taskToleranceMinutes", "Tolerância à tarefa", `${profile.taskToleranceMinutes} minutos`);
    add("readingSupport", "Apoio na leitura", supportInfo(profile.readingSupport).label);
    add("writingSupport", "Apoio na escrita", supportInfo(profile.writingSupport).label);
    add("mathSupport", "Apoio em matemática", supportInfo(profile.mathSupport).label);
    add("groupWork", "Apoio no trabalho em grupo", supportInfo(profile.groupWork).label);
    add("fineMotor", "Apoio na coordenação fina", supportInfo(profile.fineMotor).label);
    add("organization", "Apoio na organização", supportInfo(profile.organization).label);
    add("sensoryProfile", "Perfil sensorial", sensory);
    add("calmingStrategies", "O que ajuda a se regular", list(profile.calmingStrategies));
    add("triggers", "O que pode desorganizar", list(profile.triggers));
    add("interests", "Interesses", list(profile.interests));
    add("barriers", "Barreiras ativas", parseJson<string[]>(profile.barriers, []).map((item) => BARRIERS[item] ?? item).join(", "));
    add("strengths", "Potencialidades", profile.strengths ?? "");
  }
  if (caseStudy) {
    const at = caseStudy.updatedAt.toISOString();
    const source = caseStudy.status === "concluido" ? "Estudo de caso (concluído)" : "Estudo de caso (em elaboração)";
    const content = parseCaseStudy(caseStudy.content);
    for (const key of CASE_STUDY_REFS) {
      const field = CASE_STUDY_FIELDS.find((item) => item.key === key);
      const value = content[key]?.trim();
      if (field && value) refs.push({ field: `estudo.${key}`, label: field.label, value: value.replace(/;\s*/g, ", "), source, updatedAt: at, version: `estudo@${at}` });
    }
  }
  return refs;
}

// Objetivos do Plano de ensino ativo do estudante, para vincular o apoio.
export async function planObjectives(user: SessionUser, studentId: string) {
  await studentInReach(user, studentId);
  const objectives = await prisma.objective.findMany({
    where: { plan: { studentId, status: "ativo" } },
    select: { id: true, planId: true, description: true, status: true },
    orderBy: { createdAt: "asc" },
  });
  return objectives;
}

export type SupportInput = {
  barrierDescription: string;
  barrierStatus: string;
  support: string;
  purpose: string;
  usageContext: string;
  profileFields: string[];
  objectiveIds: string[];
  individualObjectiveText: string;
  individualObjectiveJustification: string;
  individualObjectiveId: string;
};

// Monta os dados conferindo no servidor que perfil e objetivos são DESTE estudante.
async function buildSupportData(user: SessionUser, studentId: string, input: SupportInput, previous: DuaSupportData | null, authorKind: "professor" | "colaboracao"): Promise<DuaSupportData> {
  const available = await profileReferences(user, studentId);
  const profileRefs = available.filter((ref) => input.profileFields.includes(ref.field));
  const objectives = await planObjectives(user, studentId);
  const byId = new Map(objectives.map((item) => [item.id, item]));
  const planLinks: PlanLink[] = [...new Set(input.objectiveIds)].filter((id) => byId.has(id)).map((id) => ({ kind: "objetivo", planId: byId.get(id)!.planId, objectiveId: id, description: byId.get(id)!.description }));
  if (input.objectiveIds.some((id) => id && !byId.has(id))) throw new DuaError("Um dos objetivos escolhidos não pertence ao plano deste estudante.");
  const individualText = clip(input.individualObjectiveText, 600);
  if (input.individualObjectiveId && !byId.has(input.individualObjectiveId)) throw new DuaError("O objetivo individual precisa ser do plano deste estudante.");
  return {
    barrier: { description: clip(input.barrierDescription, 600), status: BARRIER_STATUSES.includes(input.barrierStatus as never) ? (input.barrierStatus as DuaSupportData["barrier"]["status"]) : "prevista" },
    support: clip(input.support, 1200),
    purpose: clip(input.purpose, 600),
    usageContext: clip(input.usageContext, 300),
    profileRefs,
    planLinks,
    studentVoice: previous?.studentVoice ?? [],
    individualObjective: individualText ? { text: individualText, justification: clip(input.individualObjectiveJustification, 600), objectiveId: input.individualObjectiveId || null } : null,
    origin: previous?.origin ?? { kind: authorKind },
  };
}

export async function createSupport(user: SessionUser, planningId: string, studentId: string, input: SupportInput) {
  // Quem lê o planejamento (inclusive compartilhado) planeja o apoio dos SEUS estudantes.
  const { planning, access } = await loadPlanningFor(user, planningId, "read");
  const student = await studentInReach(user, studentId);
  const data = await buildSupportData(user, studentId, input, null, access.owner ? "professor" : "colaboracao");
  const problems = supportProblems(data);
  if (!data.support && !data.barrier.description) throw new DuaError("Descreva ao menos a barreira ou o apoio planejado.", "invalido", problems);
  const support = await prisma.duaSupport.create({
    data: { planningId, studentId, data: JSON.stringify(data), responsibleId: user.id, responsibleName: user.name, createdById: user.id, createdByName: user.name },
  });
  await audit(user, planningId, "planejou apoio individual", "apoio", { objectId: support.id });
  await studentLog(user, student.id, "criou", `Apoio individual na atividade com DUA "${planning.title}"`);
  return support.id;
}

// Quem pode mexer num apoio: quem edita o planejamento ou o responsável pelo apoio,
// sempre dentro do recorte do estudante.
async function loadSupportFor(user: SessionUser, supportId: string, need: "edit" | "validate") {
  const support = await prisma.duaSupport.findUnique({ where: { id: supportId }, include: { planning: true, student: { select: { id: true, schoolId: true, name: true } } } });
  if (!support) throw new DuaError("Apoio não encontrado.", "nao_encontrado");
  const access = planningAccess(user, support.planning);
  if (!access.read || !canWorkWithStudent(user, support.student)) throw new DuaError("Apoio não encontrado.", "nao_encontrado");
  const responsible = support.responsibleId === user.id;
  const allowed = need === "edit" ? access.edit || responsible : access.validate || (responsible && VALIDATORS.has(user.role));
  if (!allowed) throw new DuaError(STUDENT_FORBIDDEN, "sem_permissao");
  return { support, access, data: parseJson<DuaSupportData>(support.data, null as never) };
}

export async function updateSupport(user: SessionUser, supportId: string, revision: number, input: SupportInput) {
  const { support, access, data: previous } = await loadSupportFor(user, supportId, "edit");
  const data = await buildSupportData(user, support.studentId, input, previous, access.owner ? "professor" : "colaboracao");
  // Editar um apoio validado devolve para rascunho: a validação vale para o que foi conferido.
  const updated = await prisma.duaSupport.updateMany({ where: { id: supportId, revision }, data: { data: JSON.stringify(data), state: "rascunho", validatedAt: null, validatedById: null, validatedByName: null, revision: { increment: 1 } } });
  if (!updated.count) throw new DuaError("Outro profissional alterou este apoio agora há pouco. Atualize a página e confira antes de salvar.", "conflito");
  await audit(user, support.planningId, "editou apoio individual", "apoio", { objectId: supportId });
  await studentLog(user, support.studentId, "editou", `Apoio individual na atividade com DUA "${support.planning.title}"`);
}

export async function validateSupport(user: SessionUser, supportId: string, revision: number) {
  const { support, data } = await loadSupportFor(user, supportId, "validate");
  const problems = supportProblems(data);
  if (problems.length) throw new DuaError("Ainda falta completar o apoio para validar.", "invalido", problems);
  const updated = await prisma.duaSupport.updateMany({ where: { id: supportId, revision }, data: { state: "validado", validatedAt: new Date(), validatedById: user.id, validatedByName: user.name, revision: { increment: 1 } } });
  if (!updated.count) throw new DuaError("Outro profissional alterou este apoio agora há pouco. Atualize a página e confira antes de validar.", "conflito");
  // Validar não altera matrícula, classificação nem perfil (CA12).
  await audit(user, support.planningId, "validou apoio individual", "apoio", { objectId: supportId });
  await studentLog(user, support.studentId, "editou", `Apoio individual validado na atividade com DUA "${support.planning.title}"`);
}

// Participação do estudante (3.4): sempre com contexto, origem e data; revisável.
export async function addStudentVoice(user: SessionUser, supportId: string, entry: Omit<StudentVoiceEntry, "id">) {
  const { support, data } = await loadSupportFor(user, supportId, "edit");
  if (!STUDENT_VOICE_KINDS.includes(entry.kind) || !VOICE_ORIGINS.includes(entry.origin)) throw new DuaError("Escolha o tipo e a origem da informação.");
  const text = clip(entry.text, 600);
  const context = clip(entry.context, 300);
  if (!text || !context || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) throw new DuaError("Registre o que foi dito ou mostrado, o contexto e a data.");
  const next: DuaSupportData = { ...data, studentVoice: [...data.studentVoice, { id: randomUUID(), kind: entry.kind, text, context, origin: entry.origin, date: entry.date }].slice(-40) };
  await prisma.duaSupport.update({ where: { id: supportId }, data: { data: JSON.stringify(next), revision: { increment: 1 } } });
  await studentLog(user, support.studentId, "editou", `Participação do estudante registrada na atividade com DUA "${support.planning.title}"`);
}

export async function removeStudentVoice(user: SessionUser, supportId: string, entryId: string) {
  const { support, data } = await loadSupportFor(user, supportId, "edit");
  const next: DuaSupportData = { ...data, studentVoice: data.studentVoice.filter((item) => item.id !== entryId) };
  await prisma.duaSupport.update({ where: { id: supportId }, data: { data: JSON.stringify(next), revision: { increment: 1 } } });
  await studentLog(user, support.studentId, "editou", `Registro de participação revisado na atividade com DUA "${support.planning.title}"`);
}

export type SupportView = {
  id: string;
  planningId: string;
  planningTitle: string;
  student: { id: string; name: string };
  data: DuaSupportData;
  state: "rascunho" | "validado";
  revision: number;
  responsibleName: string;
  validatedByName: string | null;
  validatedAt: Date | null;
  updatedAt: Date;
  canEdit: boolean;
  canValidate: boolean;
  canOpenPlanning: boolean;
};

function viewOf(user: SessionUser, row: { id: string; planningId: string; data: string; state: string; revision: number; responsibleId: string; responsibleName: string; validatedByName: string | null; validatedAt: Date | null; updatedAt: Date; planning: { title: string; ownerId: string; schoolId: string | null; sharing: string; collaborators: string }; student: { id: string; name: string } }): SupportView {
  const access = planningAccess(user, row.planning);
  const responsible = row.responsibleId === user.id;
  return {
    id: row.id,
    planningId: row.planningId,
    planningTitle: row.planning.title,
    student: row.student,
    data: parseJson<DuaSupportData>(row.data, null as never),
    state: row.state as SupportView["state"],
    revision: row.revision,
    responsibleName: row.responsibleName,
    validatedByName: row.validatedByName,
    validatedAt: row.validatedAt,
    updatedAt: row.updatedAt,
    canEdit: access.read && (access.edit || responsible),
    canValidate: access.read && (access.validate || (responsible && VALIDATORS.has(user.role))),
    canOpenPlanning: access.read,
  };
}

// Apoios de um planejamento: só os dos estudantes no recorte de quem lê.
export async function listSupports(user: SessionUser, planningId: string): Promise<SupportView[]> {
  await loadPlanningFor(user, planningId, "read");
  const rows = await prisma.duaSupport.findMany({
    where: { planningId },
    include: { planning: { select: { title: true, ownerId: true, schoolId: true, sharing: true, collaborators: true } }, student: { select: { id: true, name: true, schoolId: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.filter((row) => canWorkWithStudent(user, row.student)).map((row) => viewOf(user, { ...row, student: { id: row.student.id, name: row.student.name } }));
}

// Apoios de um estudante em todas as atividades (memória educacional do estudante).
export async function listStudentSupports(user: SessionUser, studentId: string): Promise<SupportView[]> {
  const student = await studentInReach(user, studentId);
  const rows = await prisma.duaSupport.findMany({
    where: { studentId },
    include: { planning: { select: { title: true, ownerId: true, schoolId: true, sharing: true, collaborators: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((row) => viewOf(user, { ...row, student: { id: student.id, name: student.name } }));
}

export async function getSupport(user: SessionUser, supportId: string): Promise<SupportView> {
  const row = await prisma.duaSupport.findUnique({
    where: { id: supportId },
    include: { planning: { select: { title: true, ownerId: true, schoolId: true, sharing: true, collaborators: true } }, student: { select: { id: true, name: true, schoolId: true } } },
  });
  if (!row || !canWorkWithStudent(user, row.student) || !planningAccess(user, row.planning).read) throw new DuaError("Apoio não encontrado.", "nao_encontrado");
  return viewOf(user, { ...row, student: { id: row.student.id, name: row.student.name } });
}
