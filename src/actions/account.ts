"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentSessionId, getCurrentUser, getPendingLogin, hashPassword, loginAllowed, loginStep, recordLoginAttempt, upgradeSession, verifyPassword } from "@/lib/auth";
import { recordAccountEvent } from "@/lib/accounts";
import { passwordProblem } from "@/lib/user-admin";

// A própria conta (seção 14): criar a senha no primeiro acesso e trocar a senha.

export type PasswordState = { error?: string; saved?: boolean };

function readPasswords(formData: FormData) {
  return { password: String(formData.get("password") ?? ""), confirm: String(formData.get("confirm") ?? "") };
}

function newPasswordProblem(password: string, confirm: string, user: { email: string; name: string; passwordHash: string }, sameMessage: string): string | null {
  const problem = passwordProblem(password, user);
  if (problem) return problem;
  if (password !== confirm) return "As duas senhas não são iguais. Digite de novo.";
  if (verifyPassword(password, user.passwordHash)) return sameMessage;
  return null;
}

// Primeiro acesso com a senha temporária: a pessoa cria a dela e segue para a
// segunda etapa, se houver; senão, a sessão vira completa.
export async function setPasswordAtLogin(_previous: PasswordState, formData: FormData): Promise<PasswordState> {
  const pending = await getPendingLogin();
  if (!pending) redirect("/login");
  const { user } = pending;
  if (!user.mustChangePassword) redirect("/login/duas-etapas");
  const { password, confirm } = readPasswords(formData);
  const problem = newPasswordProblem(password, confirm, user, "Escolha uma senha diferente da temporária.");
  if (problem) return { error: problem };
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(password), mustChangePassword: false, passwordChangedAt: new Date() } });
  await recordAccountEvent(user.id, user, "criou a própria senha", "No primeiro acesso, no lugar da senha temporária");
  const next = loginStep({ ...user, mustChangePassword: false });
  if (next) redirect(`/login/${next}`);
  await upgradeSession(pending.sessionId, user.id);
  redirect("/");
}

// Trocar a senha: confere a atual (com o mesmo limite de tentativas do login)
// e encerra as outras sessões da conta.
export async function changeOwnPassword(_previous: PasswordState, formData: FormData): Promise<PasswordState> {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.id } });
  const key = `senha:${user.email}`;
  if (!(await loginAllowed(key))) return { error: "Muitas tentativas com a senha atual errada. Aguarde 15 minutos." };
  const current = String(formData.get("current") ?? "");
  const right = verifyPassword(current, user.passwordHash);
  await recordLoginAttempt(key, right);
  if (!right) return { error: "A senha atual não confere." };
  const { password, confirm } = readPasswords(formData);
  const problem = newPasswordProblem(password, confirm, user, "A senha nova precisa ser diferente da atual.");
  if (problem) return { error: problem };
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(password), passwordChangedAt: new Date() } });
  const keep = await currentSessionId();
  await prisma.session.deleteMany({ where: { userId: user.id, ...(keep ? { id: { not: keep } } : {}) } });
  await recordAccountEvent(user.id, session, "trocou a senha", "As outras sessões da conta foram encerradas");
  revalidatePath("/conta/seguranca");
  return { saved: true };
}
