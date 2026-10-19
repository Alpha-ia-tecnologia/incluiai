import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma";
import { recordView } from "./access-log";
import { LOGIN_WINDOW_MS, MFA_PENDING_MS, SESSION_MAX_AGE_MS, hashSessionToken, loginBlocked, newSessionToken, sessionState, shouldTouchSession } from "./session-core";

// Autenticação — item 7 (perfis de acesso) e 14 (LGPD). Senha com scrypt + sal.
// A sessão fica no servidor (tabela Session): o cookie leva só um código
// aleatório, que expira (8 h, ou 2 h sem uso) e é apagado ao sair. Regras puras
// em session-core.ts. Em produção: HTTPS (cookie seguro) e duas etapas
// (REQUIRE_2FA=1; regras em two-factor.ts e totp.ts).

const SESSION_COOKIE = "incluiedu_session";
// Cookie só por HTTPS em produção; SESSION_COOKIE_SECURE=0 libera o teste local
// do build de produção em http://127.0.0.1.
const SECURE_COOKIE = process.env.SESSION_COOKIE_SECURE ? process.env.SESSION_COOKIE_SECURE === "1" : process.env.NODE_ENV === "production";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

// E-mail sem conta também passa pelo scrypt: o tempo de resposta não revela
// quais e-mails existem.
let dummyHash: string | null = null;
export function verifyPasswordOrDummy(password: string, stored: string | null): boolean {
  if (stored) return verifyPassword(password, stored);
  dummyHash ??= hashPassword("incluiedu-conta-inexistente");
  verifyPassword(password, dummyHash);
  return false;
}

// Limite de tentativas por e-mail (seção 14). Tentativas com mais de um dia são descartadas.
export async function loginAllowed(email: string): Promise<boolean> {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const attempts = await prisma.loginAttempt.findMany({ where: { email, createdAt: { gte: since } }, select: { success: true, createdAt: true } });
  return !loginBlocked(attempts);
}

export async function recordLoginAttempt(email: string, success: boolean): Promise<void> {
  await prisma.loginAttempt.create({ data: { email, success } });
  await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
}

// pending = senha certa, falta a segunda etapa: a sessão só abre /login/duas-etapas.
export async function createSession(userId: string, { pending = false }: { pending?: boolean } = {}): Promise<void> {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + (pending ? MFA_PENDING_MS : SESSION_MAX_AGE_MS));
  await prisma.session.create({ data: { tokenHash: hashSessionToken(token), userId, expiresAt, mfaPending: pending } });
  // Último acesso (para a gestão ver quem nunca entrou): só com o login completo.
  if (!pending) await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  // Sessões vencidas de qualquer pessoa saem do banco a cada nova entrada.
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: SECURE_COOKIE,
    path: "/",
    expires: expiresAt,
  });
}

// Segunda etapa concluída: a sessão pendente sai e entra uma nova, com outro
// código (quem viu o código da etapa anterior não ganha a sessão completa).
export async function upgradeSession(pendingSessionId: string, userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: pendingSessionId, mfaPending: true } });
  await createSession(userId);
}

async function sessionFromCookie() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: { include: { studentLinks: { select: { studentId: true }, orderBy: { createdAt: "asc" } } } } },
  });
}

// Sessão aberta agora (para encerrar as outras ao ligar as duas etapas).
export async function currentSessionId(): Promise<string | null> {
  return (await sessionFromCookie())?.id ?? null;
}

// Sessão à espera de um passo do login (senha nova ou segunda etapa), para as
// telas /login/nova-senha e /login/duas-etapas.
export async function getPendingLogin() {
  const session = await sessionFromCookie();
  if (!session?.mfaPending || session.user.deactivatedAt || sessionState(session) !== "valida") return null;
  return { sessionId: session.id, startedAt: session.createdAt, user: session.user };
}

// O que falta depois da senha: criar a própria senha (temporária dada pela
// gestão) e, depois, a segunda etapa (ligada pela pessoa ou obrigatória).
export function loginStep(user: { role: string; mustChangePassword: boolean; totpEnabledAt: Date | null }): "nova-senha" | "duas-etapas" | null {
  if (user.mustChangePassword) return "nova-senha";
  if (user.totpEnabledAt || twoFactorRequired(user.role)) return "duas-etapas";
  return null;
}

// REQUIRE_2FA=1 (produção): a equipe da escola e a da rede só entram com a
// segunda etapa. Família e terapeuta podem ligar, sem obrigação.
export function twoFactorRequired(role: string): boolean {
  return process.env.REQUIRE_2FA === "1" && isStaffOrNetwork(role);
}

// Sair apaga a sessão no banco: o mesmo cookie, se copiado, não vale mais.
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  store.delete(SESSION_COOKIE);
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  schoolId: string | null;
  // Família e terapeuta: estudantes vinculados (StudentLink), na ordem do vínculo.
  studentIds: string[];
};

// Uma consulta por requisição, mesmo com layout, página e ação pedindo o usuário.
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await sessionFromCookie();
  if (!session) return null;
  const now = new Date();
  if (sessionState(session, now) !== "valida") {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  // Conta desativada: a sessão sai na hora.
  if (session.user.deactivatedAt) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  // Login pela metade (senha temporária, segunda etapa pendente ou obrigatória e
  // ainda não ligada): a sessão não abre a plataforma.
  if (session.mfaPending || session.user.mustChangePassword || (twoFactorRequired(session.user.role) && !session.user.totpEnabledAt)) return null;
  if (shouldTouchSession(session.lastSeenAt, now)) await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: now } });
  const user = session.user;
  let studentIds = user.studentLinks.map((link) => link.studentId);
  // Conta de antes do vínculo múltiplo: copia o estudante do campo antigo uma vez.
  if (!studentIds.length && user.studentId && isLinkedRole(user.role)) {
    await prisma.studentLink.upsert({
      where: { userId_studentId: { userId: user.id, studentId: user.studentId } },
      create: { userId: user.id, studentId: user.studentId },
      update: {},
    }).catch(() => null);
    studentIds = [user.studentId];
  }
  return {
    id: user.id, name: user.name, email: user.email,
    role: user.role, schoolId: user.schoolId, studentIds: isLinkedRole(user.role) ? studentIds : [],
  };
});

// Cada página da ficha confere, perto dos dados, quem está abrindo (o layout
// sozinho não basta: em navegação parcial ele não roda de novo). A ficha é da
// equipe; família e terapeuta vão para os portais deles.
export async function requireStudentPage(studentId: string, section?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { schoolId: true } });
  if (!student) notFound();
  if (!canAccessStudent(user, student.schoolId, studentId)) redirect("/");
  if (user.role === "familia") redirect(`/familia/${studentId}`);
  if (user.role === "terapeuta") redirect("/terapeuta");
  if (!(await hasNominalAccess(user, studentId))) redirect(`/acesso-nominal/${studentId}`);
  if (section) await recordView(user, studentId, section);
  return user;
}

// Dados clínicos do estudo de caso (diagnóstico informado, saúde, acompanhamentos
// externos e com quem mora): só o AEE e a coordenação (seções 7 e 14, necessidade de saber).
export function canSeeClinicalDetail(role: string): boolean {
  return role === "professor_aee" || role === "coordenacao";
}

// Quem escreve na ficha do estudante (registro, plano, perfil, atividades): a
// equipe pedagógica. A Secretaria acompanha a rede pelos números e, quando
// precisa, lê uma ficha com motivo registrado, mas não altera.
export function canEditStudentRecord(role: string): boolean {
  return isStaffOrNetwork(role) && canSeePedagogicalDetail(role) && role !== "secretaria";
}

// A Secretaria vê a rede em números (seção 10): para abrir a ficha de um
// estudante com nome, informa o motivo (AccessGrant, 8 h, visível à família).
export const NOMINAL_ACCESS_HOURS = 8;
export function needsNominalJustification(role: string): boolean {
  return role === "secretaria";
}
export async function hasNominalAccess(user: SessionUser, studentId: string): Promise<boolean> {
  if (!needsNominalJustification(user.role)) return true;
  const grant = await prisma.accessGrant.findFirst({ where: { userId: user.id, studentId, expiresAt: { gt: new Date() } }, select: { id: true } });
  return Boolean(grant);
}

// Perfis com visão de gestão da rede inteira.
const NETWORK_ROLES = new Set(["secretaria", "gestao", "coordenacao"]);
// Perfis que atuam diretamente sobre o estudante na escola.
const SCHOOL_ROLES = new Set(["professor_sala", "professor_aee", "apoio", "coordenacao", "gestao"]);

export function canAccessStudent(user: SessionUser, studentSchoolId: string, studentId: string): boolean {
  if (user.role === "secretaria") return true;
  if (isLinkedRole(user.role)) return user.studentIds.includes(studentId);
  if (SCHOOL_ROLES.has(user.role)) {
    return !user.schoolId || user.schoolId === studentSchoolId;
  }
  return false;
}

export function isNetworkRole(role: string): boolean {
  return NETWORK_ROLES.has(role);
}

export function isSchoolStaff(role: string): boolean {
  return SCHOOL_ROLES.has(role);
}

// Equipe escolar ou gestão da rede — perfis com visão de listas/painéis.
// Família e terapeuta: veem só os estudantes vinculados à conta, pelos portais.
export function isLinkedRole(role: string): boolean {
  return role === "familia" || role === "terapeuta";
}

export function isStaffOrNetwork(role: string): boolean {
  return SCHOOL_ROLES.has(role) || NETWORK_ROLES.has(role);
}

// Necessidade de saber (item 7): o terapeuta não acessa notas, diário
// pedagógico completo ou dados administrativos.
export function canSeePedagogicalDetail(role: string): boolean {
  return role !== "terapeuta" && role !== "familia";
}

// Equipe pedagógica com acesso ao estudante: exigido nas ações que alteram o
// acompanhamento ou disparam IA paga.
export async function requireStudentTeam(studentId: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, schoolId: true } });
  if (!user || !student || !canEditStudentRecord(user.role) || !canAccessStudent(user, student.schoolId, student.id)) {
    throw new Error("Você não tem permissão para esta ação com este estudante.");
  }
  return user;
}
