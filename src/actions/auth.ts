"use server";

import { redirect } from "next/navigation";
import { db, isPlatformArea } from "@/lib/prisma";
import { PLATFORM_ROLE } from "@/lib/tenancy-core";
import { createSession, destroySession, loginAllowed, loginStep, recordLoginAttempt, verifyPasswordOrDummy } from "@/lib/auth";
import { homeAfterLogin } from "@/lib/tenant";

export async function login(_prev: unknown, formData: FormData): Promise<{ error?: string }> {
  const prisma = await db();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Preencha o e-mail e a senha." };
  if (!(await loginAllowed(email))) {
    return { error: "Muitas tentativas com este e-mail. Aguarde 15 minutos ou peça ajuda à coordenação." };
  }
  const found = await prisma.user.findUnique({ where: { email } });
  const user = found && (found.role === PLATFORM_ROLE) === (await isPlatformArea()) ? found : null;
  const ok = verifyPasswordOrDummy(password, user?.passwordHash ?? null);
  await recordLoginAttempt(email, ok);
  if (!user || !ok) return { error: "E-mail ou senha inválidos." };
  if (user.deactivatedAt) return { error: "Esta conta está desativada. Fale com a coordenação da escola ou com a Secretaria." };
  const step = loginStep(user);
  await createSession(user.id, { pending: Boolean(step) });
  redirect(step ? `/login/${step}` : await homeAfterLogin());
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
