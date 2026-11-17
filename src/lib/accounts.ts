import "server-only";
import { db } from "./prisma";
import { hashPassword, type SessionUser } from "./auth";
import { ACCOUNT_EVENT, endAllSessions, normalizeEmail, recordAccountEvent, resetTwoFactor } from "./account-security";
import { EMAIL_RE, accessChanged, accountSchoolProblem, canManageAccount, mergeLinks, sameLinks, temporaryPassword, type ManagedAccount } from "./user-admin";
import { linkedStudentIds, studentScopeWhere } from "./policy";
import { assignableRoles, isAccountManager, isLinkedRole, isRole, roleLabel } from "./roles";
import { UserError } from "./user-error";

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

export type AccountInput = { name: string; email: string; role: string; schoolId: string | null; studentIds: string[] };

function requireManager(manager: SessionUser) {
  if (!isAccountManager(manager.role)) throw new UserError("Você não tem permissão para gerir contas.", "forbidden");
}

async function accountFor(manager: SessionUser, id: string): Promise<AccountRow> {
  requireManager(manager);
  const account = await managedAccount(manager, id);
  if (!account) throw new UserError("Conta não encontrada.", "not_found");
  return account;
}

const schoolName = async (manager: SessionUser, schoolId: string) => (await schoolsFor(manager)).find((school) => school.id === schoolId)?.name ?? "";
const firstNames = (names: string[]) => names.map((name) => name.split(" ")[0]).join(", ");

async function checkAccount(manager: SessionUser, raw: AccountInput, selfId?: string) {
  const prisma = await db();
  const input = { ...raw, name: raw.name.trim().replace(/\s+/g, " "), email: normalizeEmail(raw.email) };
  if (input.name.length < 3 || input.name.length > 120) throw new UserError("Escreva o nome da pessoa (de 3 a 120 caracteres).");
  if (!EMAIL_RE.test(input.email) || input.email.length > 160) throw new UserError("Confira o e-mail.");
  if (!isRole(input.role) || !assignableRoles(manager.role).includes(input.role)) throw new UserError("Escolha um perfil que você pode atribuir.");
  const linked = isLinkedRole(input.role);
  const schoolId = linked ? null : input.schoolId;
  const schoolProblem = accountSchoolProblem(manager, input.role, schoolId);
  if (schoolProblem) throw new UserError(schoolProblem);
  if (schoolId && !(await schoolsFor(manager)).some((school) => school.id === schoolId)) throw new UserError("Escolha uma escola da lista.");
  const allowed = linked ? await linkableStudents(manager) : [];
  const chosen = allowed.filter((student) => input.studentIds.includes(student.id)).map((student) => ({ studentId: student.id, schoolId: student.schoolId, name: student.name }));
  if (linked && input.studentIds.some((id) => !allowed.some((student) => student.id === id))) throw new UserError("Escolha estudantes da lista.");
  const taken = await prisma.user.findFirst({ where: { email: input.email, ...(selfId ? { id: { not: selfId } } : {}) }, select: { id: true } });
  if (taken) throw new UserError("Já existe uma conta com este e-mail.");
  return { input, linked, schoolId, chosen };
}

export type CreatedAccount = { id: string; name: string; email: string; password: string };

export async function createAccount(manager: SessionUser, raw: AccountInput): Promise<CreatedAccount> {
  const prisma = await db();
  requireManager(manager);
  const { input, linked, schoolId, chosen } = await checkAccount(manager, raw);
  if (linked && !chosen.length) throw new UserError("Escolha pelo menos um estudante para vincular.");
  const password = temporaryPassword();
  const user = await prisma.user.create({
    data: {
      name: input.name, email: input.email, role: input.role, schoolId,
      passwordHash: hashPassword(password), mustChangePassword: true,
      studentLinks: { create: chosen.map((link) => ({ studentId: link.studentId })) },
    },
  });
  const where = chosen.length ? `vinculada a ${firstNames(chosen.map((link) => link.name))}` : schoolId ? `na escola ${await schoolName(manager, schoolId)}` : "na rede";
  await recordAccountEvent(user.id, manager, ACCOUNT_EVENT.created, `${roleLabel(input.role)}, ${where}. Senha temporária entregue pela gestão.`);
  return { id: user.id, name: user.name, email: user.email, password };
}

export async function updateAccount(manager: SessionUser, id: string, raw: AccountInput): Promise<void> {
  const prisma = await db();
  const account = await accountFor(manager, id);
  const { input, linked, schoolId, chosen } = await checkAccount(manager, raw, id);
  const studentIds = linked ? mergeLinks(manager, isLinkedRole(account.role) ? account.links : [], chosen) : [];
  if (linked && !studentIds.length) throw new UserError("Mantenha pelo menos um estudante vinculado. Para tirar o acesso, desative a conta.");

  const before = { email: account.email, role: account.role, schoolId: account.schoolId, studentIds: account.links.map((link) => link.studentId) };
  const after = { email: input.email, role: input.role, schoolId, studentIds };
  const linksChanged = linked && !sameLinks(before.studentIds, studentIds);
  const changes: string[] = [];
  if (input.name !== account.name) changes.push(`nome: ${input.name}`);
  if (input.email !== account.email) changes.push(`e-mail: ${input.email}`);
  if (input.role !== account.role) changes.push(`perfil: ${roleLabel(account.role)} → ${roleLabel(input.role)}`);
  if (schoolId !== account.schoolId) changes.push(schoolId ? `escola: ${await schoolName(manager, schoolId)}` : "escola: rede");
  if (linksChanged) {
    const names = await prisma.student.findMany({ where: { id: { in: studentIds } }, select: { name: true }, orderBy: { name: "asc" } });
    changes.push(`estudantes: ${firstNames(names.map((student) => student.name))}`);
  }
  if (!changes.length) return;

  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { name: input.name, email: input.email, role: input.role, schoolId, studentId: null } }),
    prisma.studentLink.deleteMany({ where: { userId: id, studentId: { notIn: studentIds } } }),
    ...studentIds.map((studentId) => prisma.studentLink.upsert({ where: { userId_studentId: { userId: id, studentId } }, create: { userId: id, studentId }, update: {} })),
  ]);
  if (accessChanged(before, after)) await endAllSessions(id);
  await recordAccountEvent(id, manager, ACCOUNT_EVENT.changed, changes.join("; "));
}

export async function resetAccountPassword(manager: SessionUser, id: string): Promise<string> {
  const prisma = await db();
  const account = await accountFor(manager, id);
  if (account.deactivatedAt) throw new UserError("Reative a conta antes de redefinir a senha.");
  const password = temporaryPassword();
  await prisma.user.update({ where: { id }, data: { passwordHash: hashPassword(password), mustChangePassword: true } });
  await endAllSessions(id);
  await recordAccountEvent(id, manager, ACCOUNT_EVENT.passwordReset, "Senha temporária entregue pela gestão; a pessoa cria a própria no próximo acesso");
  return password;
}

export async function resetAccountTwoFactor(manager: SessionUser, id: string): Promise<void> {
  const account = await accountFor(manager, id);
  if (!account.totpEnabledAt) return;
  await resetTwoFactor(id);
  await endAllSessions(id);
  await recordAccountEvent(id, manager, ACCOUNT_EVENT.twoFactorOff, "A pessoa liga de novo com o celular no próximo acesso");
}

export async function setAccountActive(manager: SessionUser, id: string, active: boolean): Promise<void> {
  const prisma = await db();
  const account = await accountFor(manager, id);
  if (active === !account.deactivatedAt) return;
  await prisma.user.update({ where: { id }, data: { deactivatedAt: active ? null : new Date() } });
  if (!active) await endAllSessions(id);
  await recordAccountEvent(id, manager, active ? ACCOUNT_EVENT.reactivated : ACCOUNT_EVENT.deactivated, active ? undefined : "As sessões abertas foram encerradas; o histórico fica guardado");
}
