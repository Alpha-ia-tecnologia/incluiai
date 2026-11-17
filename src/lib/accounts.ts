import "server-only";
import { db } from "./prisma";
import type { SessionUser } from "./auth";
import { canManageAccount, type ManagedAccount } from "./user-admin";
import { linkedStudentIds, studentScopeWhere } from "./policy";
import { assignableRoles, isLinkedRole } from "./roles";

type Actor = { id: string; name: string; role: string };

export async function recordAccountEvent(userId: string, actor: Actor, action: string, detail?: string): Promise<void> {
  const prisma = await db();
  await prisma.accountEvent.create({ data: { userId, actorId: actor.id, actorName: actor.name, actorRole: actor.role, action, detail: detail?.slice(0, 300) ?? null } });
}

const accountSelect = {
  id: true, name: true, email: true, role: true, schoolId: true, studentId: true, createdAt: true,
  deactivatedAt: true, mustChangePassword: true, totpEnabledAt: true, lastLoginAt: true,
  studentLinks: { select: { studentId: true }, orderBy: { createdAt: "asc" as const } },
};

export async function findAccounts(where: object = {}) {
  const prisma = await db();
  const [rows, schools] = await Promise.all([
    prisma.user.findMany({ where, select: accountSelect, orderBy: { name: "asc" } }),
    prisma.school.findMany({ select: { id: true, name: true } }),
  ]);
  const linked = new Map(rows.map((row) => [row.id, linkedStudentIds(row)]));
  const students = new Map((await prisma.student.findMany({ where: { id: { in: [...new Set([...linked.values()].flat())] } }, select: { id: true, name: true, schoolId: true } })).map((student) => [student.id, student]));
  return rows.map((row) => {
    const links = (linked.get(row.id) ?? []).flatMap((studentId) => {
      const student = students.get(studentId);
      return student ? [{ studentId, name: student.name, schoolId: student.schoolId }] : [];
    });
    const managed: ManagedAccount = { id: row.id, role: row.role, schoolId: row.schoolId, linkedSchoolIds: [...new Set(links.map((link) => link.schoolId))] };
    const schoolName = schools.find((school) => school.id === row.schoolId)?.name ?? null;
    return { ...row, schoolName, links: isLinkedRole(row.role) ? links : ([] as typeof links), managed };
  });
}

export type AccountRow = Awaited<ReturnType<typeof findAccounts>>[number];

export async function manageableAccounts(manager: SessionUser): Promise<AccountRow[]> {
  return (await findAccounts()).filter((row) => canManageAccount(manager, row.managed));
}

export async function managedAccount(manager: SessionUser, id: string): Promise<AccountRow | null> {
  const [row] = await findAccounts({ id });
  return row && canManageAccount(manager, row.managed) ? row : null;
}

export async function schoolsFor(manager: SessionUser) {
  const prisma = await db();
  return prisma.school.findMany({ where: manager.schoolId ? { id: manager.schoolId } : {}, select: { id: true, name: true }, orderBy: { name: "asc" } });
}

export async function linkableStudents(manager: SessionUser) {
  const prisma = await db();
  if (!assignableRoles(manager.role).some(isLinkedRole)) return [];
  return prisma.student.findMany({
    where: { status: "ativo", ...studentScopeWhere(manager) },
    select: { id: true, name: true, gradeYear: true, className: true, schoolId: true },
    orderBy: { name: "asc" },
  });
}
