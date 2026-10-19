import "server-only";
import { prisma } from "./prisma";
import type { SessionUser } from "./auth";
import { canManageAccount, isLinked, type ManagedAccount } from "./user-admin";

// Gestão de contas (seções 7 e 14): consultas no escopo de quem gerencia.
// Regras puras em user-admin.ts.

type Actor = Pick<SessionUser, "id" | "name" | "role">;

export async function recordAccountEvent(userId: string, actor: Actor, action: string, detail?: string): Promise<void> {
  await prisma.accountEvent.create({ data: { userId, actorId: actor.id, actorName: actor.name, actorRole: actor.role, action, detail: detail?.slice(0, 300) ?? null } });
}

const accountSelect = {
  id: true, name: true, email: true, role: true, schoolId: true, studentId: true, createdAt: true,
  deactivatedAt: true, mustChangePassword: true, totpEnabledAt: true, lastLoginAt: true,
  studentLinks: { select: { studentId: true, student: { select: { name: true, schoolId: true } } }, orderBy: { createdAt: "asc" as const } },
};

// A conta vista pela gestão, com os vínculos (o campo antigo conta até o primeiro acesso).
export async function findAccounts(where: object = {}) {
  const [rows, schools] = await Promise.all([
    prisma.user.findMany({ where, select: accountSelect, orderBy: { name: "asc" } }),
    prisma.school.findMany({ select: { id: true, name: true } }),
  ]);
  const legacy = rows.flatMap((row) => (row.studentId && !row.studentLinks.length ? [row.studentId] : []));
  const legacyStudents = legacy.length ? await prisma.student.findMany({ where: { id: { in: legacy } }, select: { id: true, name: true, schoolId: true } }) : [];
  return rows.map((row) => {
    const links = row.studentLinks.length
      ? row.studentLinks.map((link) => ({ studentId: link.studentId, name: link.student.name, schoolId: link.student.schoolId }))
      : legacyStudents.filter((student) => student.id === row.studentId).map((student) => ({ studentId: student.id, name: student.name, schoolId: student.schoolId }));
    const managed: ManagedAccount = { id: row.id, role: row.role, schoolId: row.schoolId, linkedSchoolIds: [...new Set(links.map((link) => link.schoolId))] };
    const schoolName = schools.find((school) => school.id === row.schoolId)?.name ?? null;
    return { ...row, schoolName, links: isLinked(row.role) ? links : ([] as typeof links), managed };
  });
}

export type AccountRow = Awaited<ReturnType<typeof findAccounts>>[number];

export async function manageableAccounts(manager: SessionUser): Promise<AccountRow[]> {
  return (await findAccounts()).filter((row) => canManageAccount(manager, row.managed));
}

// Uma conta, só se quem pede pode gerenciá-la.
export async function managedAccount(manager: SessionUser, id: string): Promise<AccountRow | null> {
  const [row] = await findAccounts({ id });
  return row && canManageAccount(manager, row.managed) ? row : null;
}

// Escolas em que quem gerencia cria contas: a própria, ou a rede inteira.
export async function schoolsFor(manager: SessionUser) {
  return prisma.school.findMany({ where: manager.schoolId ? { id: manager.schoolId } : {}, select: { id: true, name: true }, orderBy: { name: "asc" } });
}

// Estudantes que podem ser vinculados a família ou terapeuta: os ativos da
// escola de quem gerencia (a Secretaria não vincula: não vê nomes).
export async function linkableStudents(manager: SessionUser) {
  if (manager.role === "secretaria") return [];
  return prisma.student.findMany({
    where: { status: "ativo", ...(manager.schoolId ? { schoolId: manager.schoolId } : {}) },
    select: { id: true, name: true, gradeYear: true, className: true, schoolId: true },
    orderBy: { name: "asc" },
  });
}
