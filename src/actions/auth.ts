"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, loginAllowed, recordLoginAttempt, verifyPasswordOrDummy } from "@/lib/auth";

// Valida e-mail e senha, cria a sessão e entra diretamente na plataforma.
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
  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
