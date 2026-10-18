import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "../prisma";
import { canAccessStudent, canEditStudentRecord, type SessionUser } from "../auth";
import { parseJson } from "../format";
import { normalizeContent, suggestionBasis, type DuaContent } from "./domain";
import { planningAccess, type PlanningAccess } from "./access";

// Peças comuns da camada de dados do DUA. Nada aqui é ação pública: as ações
// (src/actions/dua*.ts) chamam estas funções com o usuário da sessão.

export type DuaErrorKind = "nao_encontrado" | "sem_permissao" | "conflito" | "invalido";
export class DuaError extends Error {
  constructor(message: string, readonly kind: DuaErrorKind = "invalido", readonly problems: { field: string; message: string }[] = []) {
    super(message);
  }
}

export const NOT_FOUND = "Planejamento não encontrado.";
export const FORBIDDEN = "Você não tem permissão para esta ação neste planejamento.";
export const STUDENT_FORBIDDEN = "Você não tem permissão para esta ação com este estudante.";

export type Need = keyof Omit<PlanningAccess, "owner">;

// Carrega o planejamento conferindo a permissão. Sem leitura, responde "não
// encontrado": quem está fora do recorte não fica sabendo que ele existe.
export async function loadPlanningFor(user: SessionUser, planningId: string, need: Need) {
  const planning = await prisma.duaPlanning.findUnique({ where: { id: planningId } });
  if (!planning) throw new DuaError(NOT_FOUND, "nao_encontrado");
  const access = planningAccess(user, planning);
  if (!access.read) throw new DuaError(NOT_FOUND, "nao_encontrado");
  if (!access[need]) throw new DuaError(FORBIDDEN, "sem_permissao");
  return { planning, access };
}

export async function latestVersion(planningId: string) {
  const version = await prisma.duaPlanningVersion.findFirst({ where: { planningId }, orderBy: { version: "desc" } });
  if (!version) throw new DuaError(NOT_FOUND, "nao_encontrado");
  return version;
}

export const contentOf = (version: { content: string }): DuaContent => normalizeContent(parseJson<Partial<DuaContent> | null>(version.content, null));

// Recorte do estudante: equipe pedagógica com acesso (família e terapeuta não entram no DUA).
export function canWorkWithStudent(user: SessionUser, student: { id: string; schoolId: string }) {
  return canEditStudentRecord(user.role) && canAccessStudent(user, student.schoolId, student.id);
}

export async function studentInReach(user: SessionUser, studentId: string) {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, name: true, schoolId: true, className: true } });
  if (!student) throw new DuaError("Estudante não encontrado.", "nao_encontrado");
  if (!canWorkWithStudent(user, student)) throw new DuaError(STUDENT_FORBIDDEN, "sem_permissao");
  return student;
}

// Evento do planejamento: sem nome de estudante no detalhe (o histórico é lido
// por toda a equipe do planejamento).
export async function audit(user: SessionUser, planningId: string, action: string, objectType: string, extra: { objectId?: string; versionNumber?: number; detail?: string } = {}) {
  await prisma.duaAuditEvent.create({
    data: { planningId, action, objectType, objectId: extra.objectId ?? null, versionNumber: extra.versionNumber ?? null, actorId: user.id, actorName: user.name, role: user.role, detail: extra.detail ?? null },
  });
}

// Histórico de acessos do estudante (LGPD), o mesmo lido pela família.
export async function studentLog(user: SessionUser, studentId: string, action: "criou" | "editou" | "visualizou" | "enviou", detail: string) {
  await prisma.accessLog.create({ data: { studentId, actor: user.name, role: user.role, action, detail } });
}

export const hashOf = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32);
export const basisHashOf = (content: DuaContent) => hashOf(suggestionBasis(content));

// Datas vindas de <input type="date"> ao meio-dia, para não trocar de dia pelo fuso.
export function dateFromInput(value: string, label = "a data"): Date {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(Number.NaN);
  if (Number.isNaN(date.getTime())) throw new DuaError(`Informe ${label} no formato dia/mês/ano.`);
  return date;
}

export const clip = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

// Estudantes que a pessoa acompanha (para escolher participantes e apoios). A
// lista já sai filtrada pelo recorte; a ação confere de novo ao gravar.
export async function studentsInReach(user: SessionUser, filter: { className?: string | null } = {}) {
  const rows = await prisma.student.findMany({
    where: { status: "ativo", ...(user.schoolId && user.role !== "secretaria" ? { schoolId: user.schoolId } : {}), ...(filter.className ? { className: filter.className } : {}) },
    select: { id: true, name: true, schoolId: true, className: true, gradeYear: true },
    orderBy: { name: "asc" },
  });
  return rows.filter((student) => canWorkWithStudent(user, student)).map(({ id, name, className, gradeYear }) => ({ id, name, className, gradeYear }));
}
