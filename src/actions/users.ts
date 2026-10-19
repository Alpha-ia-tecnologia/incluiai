"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword, type SessionUser } from "@/lib/auth";
import { linkableStudents, managedAccount, recordAccountEvent, schoolsFor, type AccountRow } from "@/lib/accounts";
import { EMAIL_RE, accountSchoolProblem, assignableRoles, isAccountManager, isLinked, mergeLinks, temporaryPassword } from "@/lib/user-admin";
import { ROLES } from "@/lib/scale";

// Pessoas e acessos (seções 7 e 14): a gestão cria e altera contas, redefine a
// senha, desliga as duas etapas de quem perdeu o celular e desativa contas.
// Cada passo confere o escopo no servidor e fica no histórico da conta.

// values: o que foi enviado, para o formulário não se apagar quando há erro.
export type AccountFormState = { error?: string; saved?: boolean; created?: { id: string; name: string; email: string; password: string }; values?: AccountInput };
export type ResetState = { error?: string; password?: string };

async function requireManager(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAccountManager(user.role)) redirect("/");
  return user;
}

async function requireAccount(manager: SessionUser, id: string): Promise<AccountRow> {
  const account = await managedAccount(manager, id);
  if (!account) redirect("/usuarios");
  return account;
}

export type AccountInput = { name: string; email: string; role: string; schoolId: string | null; studentIds: string[] };

function readAccount(formData: FormData): AccountInput {
  return {
    name: String(formData.get("name") ?? "").trim().replace(/\s+/g, " "),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    role: String(formData.get("role") ?? ""),
    schoolId: String(formData.get("schoolId") ?? "") || null,
    studentIds: formData.getAll("studentIds").map(String),
  };
}

// Confere os dados contra o escopo de quem gerencia e devolve os estudantes
// escolhidos (com a escola, para o recorte dos vínculos).
async function checkAccount(manager: SessionUser, input: AccountInput, selfId?: string) {
  if (input.name.length < 3 || input.name.length > 120) return { error: "Escreva o nome da pessoa (de 3 a 120 caracteres)." } as const;
  if (!EMAIL_RE.test(input.email) || input.email.length > 160) return { error: "Confira o e-mail." } as const;
  if (!assignableRoles(manager).includes(input.role)) return { error: "Escolha um perfil que você pode atribuir." } as const;
  const linked = isLinked(input.role);
  const schoolId = linked ? null : input.schoolId;
  const schoolProblem = accountSchoolProblem(manager, input.role, schoolId);
  if (schoolProblem) return { error: schoolProblem } as const;
  if (schoolId && !(await schoolsFor(manager)).some((school) => school.id === schoolId)) return { error: "Escolha uma escola da lista." } as const;
  const allowed = linked ? await linkableStudents(manager) : [];
  const chosen = allowed.filter((student) => input.studentIds.includes(student.id)).map((student) => ({ studentId: student.id, schoolId: student.schoolId, name: student.name }));
  if (linked && input.studentIds.some((id) => !allowed.some((student) => student.id === id))) return { error: "Escolha estudantes da lista." } as const;
  const taken = await prisma.user.findFirst({ where: { email: input.email, ...(selfId ? { id: { not: selfId } } : {}) }, select: { id: true } });
  if (taken) return { error: "Já existe uma conta com este e-mail." } as const;
  return { schoolId, chosen } as const;
}

const firstNames = (names: string[]) => names.map((name) => name.split(" ")[0]).join(", ");

export async function createAccount(_previous: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const manager = await requireManager();
  const input = readAccount(formData);
  const checked = await checkAccount(manager, input);
  if ("error" in checked) return { error: checked.error, values: input };
  if (isLinked(input.role) && !checked.chosen.length) return { error: "Escolha pelo menos um estudante para vincular.", values: input };
  const password = temporaryPassword();
  const user = await prisma.user.create({
    data: {
      name: input.name, email: input.email, role: input.role, schoolId: checked.schoolId,
      passwordHash: hashPassword(password), mustChangePassword: true,
      studentLinks: { create: checked.chosen.map((link) => ({ studentId: link.studentId })) },
    },
  });
  const where = checked.chosen.length ? `vinculada a ${firstNames(checked.chosen.map((link) => link.name))}` : checked.schoolId ? `na escola ${(await schoolsFor(manager)).find((school) => school.id === checked.schoolId)?.name ?? ""}` : "na rede";
  await recordAccountEvent(user.id, manager, "criou a conta", `${ROLES[input.role] ?? input.role}, ${where}. Senha temporária entregue pela gestão.`);
  revalidatePath("/usuarios");
  return { created: { id: user.id, name: user.name, email: user.email, password } };
}

export async function updateAccount(id: string, _previous: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const manager = await requireManager();
  const account = await requireAccount(manager, id);
  const input = readAccount(formData);
  const checked = await checkAccount(manager, input, id);
  if ("error" in checked) return { error: checked.error, values: input };
  const linked = isLinked(input.role);
  // Quem gerencia na escola só mexe nos vínculos da própria escola.
  const studentIds = linked ? mergeLinks(manager, isLinked(account.role) ? account.links : [], checked.chosen) : [];
  if (linked && !studentIds.length) return { error: "Mantenha pelo menos um estudante vinculado. Para tirar o acesso, desative a conta.", values: input };

  const changes: string[] = [];
  if (input.name !== account.name) changes.push(`nome: ${input.name}`);
  if (input.email !== account.email) changes.push(`e-mail: ${input.email}`);
  if (input.role !== account.role) changes.push(`perfil: ${ROLES[account.role] ?? account.role} → ${ROLES[input.role] ?? input.role}`);
  if (checked.schoolId !== account.schoolId) changes.push(checked.schoolId ? `escola: ${(await schoolsFor(manager)).find((school) => school.id === checked.schoolId)?.name ?? ""}` : "escola: rede");
  const before = account.links.map((link) => link.studentId).sort().join();
  const linksChanged = linked && studentIds.slice().sort().join() !== before;
  if (linksChanged) {
    const names = await prisma.student.findMany({ where: { id: { in: studentIds } }, select: { name: true }, orderBy: { name: "asc" } });
    changes.push(`estudantes: ${firstNames(names.map((student) => student.name))}`);
  }
  if (!changes.length) return { saved: true };

  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { name: input.name, email: input.email, role: input.role, schoolId: checked.schoolId, studentId: null } }),
    prisma.studentLink.deleteMany({ where: { userId: id, studentId: { notIn: studentIds } } }),
    ...studentIds.map((studentId) => prisma.studentLink.upsert({ where: { userId_studentId: { userId: id, studentId } }, create: { userId: id, studentId }, update: {} })),
  ]);
  // Perfil, escola ou vínculos mudaram: a pessoa entra de novo com o acesso novo.
  const accessChanged = input.role !== account.role || checked.schoolId !== account.schoolId || linksChanged || input.email !== account.email;
  if (accessChanged) await prisma.session.deleteMany({ where: { userId: id } });
  await recordAccountEvent(id, manager, "alterou a conta", changes.join("; "));
  revalidatePath("/usuarios");
  revalidatePath(`/usuarios/${id}`);
  return { saved: true };
}

// Senha esquecida: a gestão gera uma temporária, que a pessoa troca no próximo acesso.
export async function resetAccountPassword(id: string, _previous: ResetState): Promise<ResetState> {
  const manager = await requireManager();
  const account = await requireAccount(manager, id);
  if (account.deactivatedAt) return { error: "Reative a conta antes de redefinir a senha." };
  const password = temporaryPassword();
  await prisma.user.update({ where: { id }, data: { passwordHash: hashPassword(password), mustChangePassword: true } });
  await prisma.session.deleteMany({ where: { userId: id } });
  await recordAccountEvent(id, manager, "redefiniu a senha", "Senha temporária entregue pela gestão; a pessoa cria a própria no próximo acesso");
  revalidatePath(`/usuarios/${id}`);
  return { password };
}

// Celular perdido e sem códigos de recuperação: a gestão desliga as duas etapas,
// e a pessoa liga de novo no próximo acesso (obrigatório com REQUIRE_2FA).
export async function resetAccountTwoFactor(id: string): Promise<void> {
  const manager = await requireManager();
  const account = await requireAccount(manager, id);
  if (!account.totpEnabledAt) return;
  await prisma.user.update({ where: { id }, data: { totpSecret: null, totpPendingSecret: null, totpEnabledAt: null, totpLastStep: null, recoveryCodes: null } });
  await prisma.session.deleteMany({ where: { userId: id } });
  await recordAccountEvent(id, manager, "desligou as duas etapas", "A pessoa liga de novo com o celular no próximo acesso");
  revalidatePath(`/usuarios/${id}`);
}

export async function setAccountActive(id: string, active: boolean): Promise<void> {
  const manager = await requireManager();
  const account = await requireAccount(manager, id);
  if (active === !account.deactivatedAt) return;
  await prisma.user.update({ where: { id }, data: { deactivatedAt: active ? null : new Date() } });
  if (!active) await prisma.session.deleteMany({ where: { userId: id } });
  await recordAccountEvent(id, manager, active ? "reativou a conta" : "desativou a conta", active ? undefined : "As sessões abertas foram encerradas; o histórico fica guardado");
  revalidatePath("/usuarios");
  revalidatePath(`/usuarios/${id}`);
}
