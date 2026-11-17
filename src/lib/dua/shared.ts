import "server-only";
import { createHash } from "node:crypto";
import { db } from "../prisma";
import type { SessionUser } from "../auth";
import { canWorkWithStudent, studentScopeWhere } from "../policy";
import { parseJson } from "../format";
import { UserError } from "../user-error";
import { normalizeContent, suggestionBasis, type DuaContent } from "./domain";
import { planningAccess, type PlanningAccess } from "./access";

export const NOT_FOUND = "Planejamento não encontrado.";
export const FORBIDDEN = "Você não tem permissão para esta ação neste planejamento.";

export type Need = keyof Omit<PlanningAccess, "owner">;

export async function loadPlanningFor(user: SessionUser, planningId: string, need: Need) {
  const prisma = await db();
  const planning = await prisma.duaPlanning.findUnique({ where: { id: planningId } });
  if (!planning) throw new UserError(NOT_FOUND, "not_found");
  const access = planningAccess(user, planning);
  if (!access.read) throw new UserError(NOT_FOUND, "not_found");
  if (!access[need]) throw new UserError(FORBIDDEN, "forbidden");
  return { planning, access };
}

export async function latestVersion(planningId: string) {
  const prisma = await db();
  const version = await prisma.duaPlanningVersion.findFirst({ where: { planningId }, orderBy: { version: "desc" } });
  if (!version) throw new UserError(NOT_FOUND, "not_found");
  return version;
}

export const contentOf = (version: { content: string }): DuaContent => normalizeContent(parseJson<Partial<DuaContent> | null>(version.content, null));

export async function audit(user: SessionUser, planningId: string, action: string, objectType: string, extra: { objectId?: string; versionNumber?: number; detail?: string } = {}) {
  const prisma = await db();
  await prisma.duaAuditEvent.create({
    data: { planningId, action, objectType, objectId: extra.objectId ?? null, versionNumber: extra.versionNumber ?? null, actorId: user.id, actorName: user.name, role: user.role, detail: extra.detail ?? null },
  });
}

export const hashOf = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32);
export const basisHashOf = (content: DuaContent) => hashOf(suggestionBasis(content));

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
