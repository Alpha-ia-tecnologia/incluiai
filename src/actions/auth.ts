"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession, destroySession } from "@/lib/auth";

// Valida e-mail e senha, cria a sessão e entra diretamente na plataforma.
// Em caso de erro, devolve o e-mail digitado para o campo não ficar vazio.
export async function login(_prev: unknown, formData: FormData): Promise<{ error?: string; email?: string }> {
  const typed = String(formData.get("email") ?? "").trim().slice(0, 200);
  const email = typed.toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: "E-mail ou senha não conferem. Confira os dois e tente de novo.", email: typed };
  }
  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
