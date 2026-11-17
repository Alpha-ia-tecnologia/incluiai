import "server-only";
import { createHash } from "node:crypto";
import { db } from "../prisma";
import type { SessionUser } from "../auth";
import { canWorkWithStudent, studentScopeWhere } from "../policy";
import { parseJson } from "../format";
import { normalizeContent, suggestionBasis, type DuaContent } from "./domain";
import { planningAccess, type PlanningAccess } from "./access";

export type DuaErrorKind = "nao_encontrado" | "sem_permissao" | "conflito" | "invalido";
export class DuaError extends Error {
  constructor(message: string, readonly kind: DuaErrorKind = "invalido", readonly problems: { field: string; message: string }[] = []) {
    super(message);
  }
}

export const NOT_FOUND = "Planejamento não encontrado.";
export const FORBIDDEN = "Você não tem permissão para esta ação neste planejamento.";

export type Need = keyof Omit<PlanningAccess, "owner">;

export async function loadPlanningFor(user: SessionUser, planningId: string, need: Need) {
  const prisma = await db();
  const planning = await prisma.duaPlanning.findUnique({ where: { id: planningId } });
  if (!planning) throw new DuaError(NOT_FOUND, "nao_encontrado");
  const access = planningAccess(user, planning);
  if (!access.read) throw new DuaError(NOT_FOUND, "nao_encontrado");
  if (!access[need]) throw new DuaError(FORBIDDEN, "sem_permissao");
  return { planning, access };
}

export async function latestVersion(planningId: string) {
  const prisma = await db();
  const version = await prisma.duaPlanningVersion.findFirst({ where: { planningId }, orderBy: { version: "desc" } });
  if (!version) throw new DuaError(NOT_FOUND, "nao_encontrado");
  return version;
}

export const contentOf = (version: { content: string }): DuaContent => normalizeContent(parseJson<Partial<DuaContent> | null>(version.content, null));

export { canWorkWithStudent } from "../policy";

export async function audit(user: SessionUser, planningId: string, action: string, objectType: string, extra: { objectId?: string; versionNumber?: number; detail?: string } = {}) {
  const prisma = await db();
  await prisma.duaAuditEvent.create({
    data: { planningId, action, objectType, objectId: extra.objectId ?? null, versionNumber: extra.versionNumber ?? null, actorId: user.id, actorName: user.name, role: user.role, detail: extra.detail ?? null },
  });
}

export async function studentLog(user: { name: string; role: string }, studentId: string, action: "criou" | "editou" | "visualizou" | "enviou", detail: string) {
  const prisma = await db();
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

export async function studentsInReach(user: SessionUser, filter: { className?: string | null } = {}) {
  const prisma = await db();
  const rows = await prisma.student.findMany({
    where: { status: "ativo", ...studentScopeWhere(user), ...(filter.className ? { className: filter.className } : {}) },
    select: { id: true, name: true, schoolId: true, className: true, gradeYear: true },
    orderBy: { name: "asc" },
  });
  return rows.filter((student) => canWorkWithStudent(user, student)).map(({ id, name, className, gradeYear }) => ({ id, name, className, gradeYear }));
}
