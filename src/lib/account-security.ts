import "server-only";
import { db, isPlatformArea } from "./prisma";
import { createSession, currentSessionId, getCurrentUser, getPendingLogin, hashPassword, loginStep, twoFactorRequired, upgradeSession, verifyPassword, verifyPasswordOrDummy, type SessionUser } from "./auth";
import { isPlatformRole } from "./roles";
import { LOGIN_WINDOW_MS, loginBlocked } from "./session-core";
import { newTotpSecret } from "./totp";
import { confirmTwoFactor, consumeSecondFactor, newRecoveryCodesFor } from "./two-factor";
import { passwordProblem } from "./user-admin";
import { UserError } from "./user-error";

type Actor = { id: string; name: string; role: string };

export const ACCOUNT_EVENT = {
  created: "criou a conta",
  changed: "alterou a conta",
  passwordReset: "redefiniu a senha",
  reactivated: "reativou a conta",
  deactivated: "desativou a conta",
  ownPasswordCreated: "criou a própria senha",
  passwordChanged: "trocou a senha",
  recoveryCodeUsed: "entrou com um código de recuperação",
  twoFactorOn: "ligou as duas etapas",
  twoFactorOff: "desligou as duas etapas",
  recoveryCodesRenewed: "gerou novos códigos de recuperação",
} as const;
type AccountEvent = (typeof ACCOUNT_EVENT)[keyof typeof ACCOUNT_EVENT];

export async function recordAccountEvent(userId: string, actor: Actor, action: AccountEvent, detail?: string): Promise<void> {
  const prisma = await db();
  await prisma.accountEvent.create({ data: { userId, actorId: actor.id, actorName: actor.name, actorRole: actor.role, action, detail: detail?.slice(0, 300) ?? null } });
}

export const normalizeEmail = (value: string): string => value.trim().toLowerCase();

// As chaves ficam gravadas em LoginAttempt.email: mudar o formato zera a contagem das tentativas em andamento.
const ATTEMPTS = {
  entrada: { key: (email: string) => email, blocked: "Muitas tentativas com este e-mail. Aguarde 15 minutos ou peça ajuda à coordenação." },
  senha: { key: (email: string) => `senha:${email}`, blocked: "Muitas tentativas com a senha atual errada. Aguarde 15 minutos." },
  codigo: { key: (email: string) => `mfa:${email}`, blocked: "Muitas tentativas com código errado. Aguarde 15 minutos e entre de novo." },
};
const ATTEMPTS_KEPT_MS = 24 * 60 * 60 * 1000;

async function limitedAttempt<T>(purpose: keyof typeof ATTEMPTS, email: string, attempt: () => Promise<T>): Promise<T> {
  const prisma = await db();
  const key = ATTEMPTS[purpose].key(email);
  const recent = await prisma.loginAttempt.findMany({ where: { email: key, createdAt: { gte: new Date(Date.now() - LOGIN_WINDOW_MS) } }, select: { success: true, createdAt: true } });
  if (loginBlocked(recent)) throw new UserError(ATTEMPTS[purpose].blocked);
  const value = await attempt();
  await prisma.loginAttempt.create({ data: { email: key, success: Boolean(value) } });
  await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - ATTEMPTS_KEPT_MS) } } });
  return value;
}

export async function endOtherSessions(userId: string): Promise<void> {
  const prisma = await db();
  const keep = await currentSessionId();
  await prisma.session.deleteMany({ where: { userId, ...(keep ? { id: { not: keep } } : {}) } });
}

export async function endAllSessions(userId: string): Promise<void> {
  const prisma = await db();
  await prisma.session.deleteMany({ where: { userId } });
}

export async function resetTwoFactor(userId: string): Promise<void> {
  const prisma = await db();
  await prisma.user.update({ where: { id: userId }, data: { totpSecret: null, totpPendingSecret: null, totpEnabledAt: null, totpLastStep: null, recoveryCodes: null } });
}

type LoginStep = ReturnType<typeof loginStep>;

export async function signIn(emailInput: string, password: string): Promise<LoginStep> {
  const prisma = await db();
  const email = normalizeEmail(emailInput);
  if (!email || !password) throw new UserError("Preencha o e-mail e a senha.");
  const platform = await isPlatformArea();
  const user = await limitedAttempt("entrada", email, async () => {
    const found = await prisma.user.findUnique({ where: { email } });
    const candidate = found && isPlatformRole(found.role) === platform ? found : null;
    return verifyPasswordOrDummy(password, candidate?.passwordHash ?? null) ? candidate : null;
  });
  if (!user) throw new UserError("E-mail ou senha inválidos.");
  if (user.deactivatedAt) throw new UserError("Esta conta está desativada. Fale com a coordenação da escola ou com a Secretaria.");
  const step = loginStep(user);
  await createSession(user.id, { pending: Boolean(step) });
  return step;
}

type PendingLogin = NonNullable<Awaited<ReturnType<typeof getPendingLogin>>>;
export type NewPassword = { password: string; confirm: string };

function assertNewPassword(user: { email: string; name: string; passwordHash: string }, input: NewPassword, sameMessage: string) {
  const problem = passwordProblem(input.password, user);
  if (problem) throw new UserError(problem);
  if (input.password !== input.confirm) throw new UserError("As duas senhas não são iguais. Digite de novo.");
  if (verifyPassword(input.password, user.passwordHash)) throw new UserError(sameMessage);
}

export async function createOwnPassword(pending: PendingLogin, input: NewPassword): Promise<LoginStep> {
  const prisma = await db();
  const { user } = pending;
  assertNewPassword(user, input, "Escolha uma senha diferente da temporária.");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(input.password), mustChangePassword: false, passwordChangedAt: new Date() } });
  await recordAccountEvent(user.id, user, ACCOUNT_EVENT.ownPasswordCreated, "No primeiro acesso, no lugar da senha temporária");
  const next = loginStep({ ...user, mustChangePassword: false });
  if (!next) await upgradeSession(pending.sessionId, user.id);
  return next;
}

export async function changeOwnPassword(session: SessionUser, input: NewPassword & { current: string }): Promise<void> {
  const prisma = await db();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.id } });
  const right = await limitedAttempt("senha", user.email, async () => verifyPassword(input.current, user.passwordHash));
  if (!right) throw new UserError("A senha atual não confere.");
  assertNewPassword(user, input, "A senha nova precisa ser diferente da atual.");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(input.password), passwordChangedAt: new Date() } });
  await endOtherSessions(user.id);
  await recordAccountEvent(user.id, session, ACCOUNT_EVENT.passwordChanged, "As outras sessões da conta foram encerradas");
}

type CodeOwner = { id: string; email: string; totpSecret: string | null; totpLastStep: number | null; recoveryCodes: string | null };

async function checkSecondFactor(user: CodeOwner, code: string) {
  const kind = await limitedAttempt("codigo", user.email, () => consumeSecondFactor(user, code));
  if (!kind) throw new UserError("Código inválido ou já usado. Confira o aplicativo e tente de novo.");
  return kind;
}

export async function confirmSecondStep(pending: PendingLogin, code: string): Promise<"aplicativo" | "recuperacao"> {
  if (!code) throw new UserError("Digite o código de 6 números do aplicativo.");
  const kind = await checkSecondFactor(pending.user, code);
  if (kind === "recuperacao") await recordAccountEvent(pending.user.id, pending.user, ACCOUNT_EVENT.recoveryCodeUsed);
  await upgradeSession(pending.sessionId, pending.user.id);
  return kind;
}

export type SetupUser = { id: string; name: string; role: string; pendingSessionId: string | null };

export async function twoFactorSetupUser(): Promise<SetupUser | null> {
  const user = await getCurrentUser();
  if (user) return { id: user.id, name: user.name, role: user.role, pendingSessionId: null };
  const pending = await getPendingLogin();
  if (pending && !pending.user.totpEnabledAt && !pending.user.mustChangePassword) {
    return { id: pending.user.id, name: pending.user.name, role: pending.user.role, pendingSessionId: pending.sessionId };
  }
  return null;
}

export async function startTwoFactorSetup(user: SetupUser): Promise<void> {
  const prisma = await db();
  const current = await prisma.user.findUnique({ where: { id: user.id }, select: { totpEnabledAt: true } });
  if (!current?.totpEnabledAt) await prisma.user.update({ where: { id: user.id }, data: { totpPendingSecret: newTotpSecret() } });
}

export async function cancelTwoFactorSetup(user: SetupUser): Promise<void> {
  const prisma = await db();
  await prisma.user.update({ where: { id: user.id }, data: { totpPendingSecret: null } });
}

export async function confirmTwoFactorSetup(user: SetupUser, code: string): Promise<string[]> {
  if (!code) throw new UserError("Digite o código de 6 números que aparece no aplicativo.");
  const codes = await confirmTwoFactor(user.id, code);
  if (!codes) throw new UserError("O código não bateu. Confira se o aplicativo leu o QR code desta tela e digite o código atual.");
  await recordAccountEvent(user.id, user, ACCOUNT_EVENT.twoFactorOn);
  if (!user.pendingSessionId) await endOtherSessions(user.id);
  return codes;
}

export async function regenerateRecoveryCodes(session: SessionUser, code: string): Promise<string[]> {
  const prisma = await db();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.id } });
  if (!user.totpEnabledAt) throw new UserError("Ligue a verificação em duas etapas primeiro.");
  await checkSecondFactor(user, code);
  const codes = await newRecoveryCodesFor(user.id);
  await recordAccountEvent(user.id, session, ACCOUNT_EVENT.recoveryCodesRenewed, "Os códigos antigos deixaram de valer");
  return codes;
}

export async function disableTwoFactor(session: SessionUser, code: string): Promise<void> {
  const prisma = await db();
  if (twoFactorRequired(session.role)) throw new UserError("Na sua rede, a verificação em duas etapas é obrigatória para a equipe.");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.id } });
  if (!user.totpEnabledAt) return;
  await checkSecondFactor(user, code);
  await resetTwoFactor(user.id);
  await recordAccountEvent(user.id, session, ACCOUNT_EVENT.twoFactorOff);
}
