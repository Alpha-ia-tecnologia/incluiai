"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, loginAllowed, loginStep, recordLoginAttempt, verifyPasswordOrDummy } from "@/lib/auth";

// Valida e-mail e senha e cria a sessão. Com senha temporária ou duas etapas
// (ligadas pela pessoa ou obrigatórias para a equipe), a sessão fica pendente
// até a pessoa criar a própria senha e digitar o código.
// A mensagem de erro é a mesma para e-mail e senha: não revela quem tem conta.
export async function login(_prev: unknown, formData: FormData): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Preencha o e-mail e a senha." };
  if (!(await loginAllowed(email))) {
    return { error: "Muitas tentativas com este e-mail. Aguarde 15 minutos ou peça ajuda à coordenação." };
  }
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = verifyPasswordOrDummy(password, user?.passwordHash ?? null);
  await recordLoginAttempt(email, ok);
  if (!user || !ok) return { error: "E-mail ou senha inválidos." };
  // Só depois da senha certa: quem não é dono da conta não descobre que ela existe.
  if (user.deactivatedAt) return { error: "Esta conta está desativada. Fale com a coordenação da escola ou com a Secretaria." };
  const step = loginStep(user);
  await createSession(user.id, { pending: Boolean(step) });
  redirect(step ? `/login/${step}` : "/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
