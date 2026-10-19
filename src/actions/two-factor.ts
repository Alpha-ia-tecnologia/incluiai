"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentSessionId, getCurrentUser, getPendingSecondStep, loginAllowed, recordLoginAttempt, twoFactorRequired, upgradeSession } from "@/lib/auth";
import { confirmTwoFactor, consumeSecondFactor, newRecoveryCodesFor } from "@/lib/two-factor";
import { newTotpSecret } from "@/lib/totp";

// Verificação em duas etapas (seção 14): entrar com o código, ligar, gerar
// novos códigos de recuperação e desligar. Cada código errado conta no mesmo
// limite do login (5 erros em 15 minutos), com a chave "mfa:" + e-mail.

export type CodeState = { error?: string; codes?: string[] };

const BLOCKED = "Muitas tentativas com código errado. Aguarde 15 minutos e entre de novo.";
const WRONG = "Código inválido ou já usado. Confira o aplicativo e tente de novo.";
const codeFrom = (formData: FormData) => String(formData.get("code") ?? "").trim().slice(0, 20);

// Quem pode ligar agora: a sessão completa, ou a sessão pendente de quem
// precisa ligar para entrar (REQUIRE_2FA). Quem já tem as duas etapas e está
// na sessão pendente só confere o código: não troca o segredo por aqui.
async function setupUser(): Promise<{ id: string; pendingSessionId: string | null } | null> {
  const user = await getCurrentUser();
  if (user) return { id: user.id, pendingSessionId: null };
  const pending = await getPendingSecondStep();
  if (pending && !pending.user.totpEnabledAt) return { id: pending.user.id, pendingSessionId: pending.sessionId };
  return null;
}

async function checkCode(user: { id: string; email: string; totpSecret: string | null; totpLastStep: number | null; recoveryCodes: string | null }, code: string) {
  const key = `mfa:${user.email}`;
  if (!(await loginAllowed(key))) return { error: BLOCKED } as const;
  const kind = await consumeSecondFactor(user, code);
  await recordLoginAttempt(key, Boolean(kind));
  return kind ? ({ kind } as const) : ({ error: WRONG } as const);
}

// Segunda etapa do login: o código do aplicativo ou um código de recuperação.
export async function verifySecondStep(_previous: CodeState, formData: FormData): Promise<CodeState> {
  const pending = await getPendingSecondStep();
  if (!pending) redirect("/login");
  if (!pending.user.totpEnabledAt) redirect("/login/duas-etapas");
  const code = codeFrom(formData);
  if (!code) return { error: "Digite o código de 6 números do aplicativo." };
  const result = await checkCode(pending.user, code);
  if ("error" in result) return { error: result.error };
  await upgradeSession(pending.sessionId, pending.user.id);
  // Com código de recuperação, a tela de segurança mostra quantos ainda restam.
  redirect(result.kind === "recuperacao" ? "/conta/seguranca?aviso=recuperacao" : "/");
}

export async function startTwoFactorSetup(): Promise<void> {
  const user = await setupUser();
  if (!user) redirect("/login");
  const current = await prisma.user.findUnique({ where: { id: user.id }, select: { totpEnabledAt: true } });
  if (!current?.totpEnabledAt) await prisma.user.update({ where: { id: user.id }, data: { totpPendingSecret: newTotpSecret() } });
  revalidatePath("/conta/seguranca");
  revalidatePath("/login/duas-etapas");
}

export async function cancelTwoFactorSetup(): Promise<void> {
  const user = await setupUser();
  if (!user) redirect("/login");
  await prisma.user.update({ where: { id: user.id }, data: { totpPendingSecret: null } });
  revalidatePath("/conta/seguranca");
}

// Liga com o primeiro código do aplicativo e devolve os códigos de recuperação.
// Sem revalidar: a tela mostra os códigos até a pessoa tocar em Concluir.
export async function confirmTwoFactorSetup(_previous: CodeState, formData: FormData): Promise<CodeState> {
  const user = await setupUser();
  if (!user) redirect("/login");
  const code = codeFrom(formData);
  if (!code) return { error: "Digite o código de 6 números que aparece no aplicativo." };
  const codes = await confirmTwoFactor(user.id, code);
  if (!codes) return { error: "O código não bateu. Confira se o aplicativo leu o QR code desta tela e digite o código atual." };
  // Ligar as duas etapas encerra as outras sessões abertas desta conta.
  if (!user.pendingSessionId) {
    const keep = await currentSessionId();
    await prisma.session.deleteMany({ where: { userId: user.id, ...(keep ? { id: { not: keep } } : {}) } });
  }
  return { codes };
}

// Depois de ligar na sessão pendente (REQUIRE_2FA): a sessão vira completa só
// se as duas etapas foram ligadas nesta mesma sessão.
export async function finishSecondStepSetup(): Promise<void> {
  const pending = await getPendingSecondStep();
  if (!pending) redirect("/login");
  if (!pending.user.totpEnabledAt || pending.user.totpEnabledAt < pending.startedAt) redirect("/login/duas-etapas");
  await upgradeSession(pending.sessionId, pending.user.id);
  redirect("/");
}

export async function regenerateRecoveryCodes(_previous: CodeState, formData: FormData): Promise<CodeState> {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.id } });
  if (!user.totpEnabledAt) return { error: "Ligue a verificação em duas etapas primeiro." };
  const result = await checkCode(user, codeFrom(formData));
  if ("error" in result) return { error: result.error };
  return { codes: await newRecoveryCodesFor(user.id) };
}

export async function disableTwoFactor(_previous: CodeState, formData: FormData): Promise<CodeState> {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (twoFactorRequired(session.role)) return { error: "Na sua rede, a verificação em duas etapas é obrigatória para a equipe." };
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.id } });
  if (!user.totpEnabledAt) return {};
  const result = await checkCode(user, codeFrom(formData));
  if ("error" in result) return { error: result.error };
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: null, totpPendingSecret: null, totpEnabledAt: null, totpLastStep: null, recoveryCodes: null },
  });
  revalidatePath("/conta/seguranca");
  return {};
}

// Computador da escola esquecido aberto: encerra as outras sessões desta conta.
export async function endOtherSessions(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const keep = await currentSessionId();
  await prisma.session.deleteMany({ where: { userId: user.id, ...(keep ? { id: { not: keep } } : {}) } });
  revalidatePath("/conta/seguranca");
}
