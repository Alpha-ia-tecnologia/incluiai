import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma";
import { recordView } from "./access-log";
import { LOGIN_WINDOW_MS, SESSION_MAX_AGE_MS, hashSessionToken, loginBlocked, newSessionToken, sessionState, shouldTouchSession } from "./session-core";

// Autenticação — item 7 (perfis de acesso) e 14 (LGPD). Senha com scrypt + sal.
// A sessão fica no servidor (tabela Session): o cookie leva só um código
// aleatório, que expira (8 h, ou 2 h sem uso) e é apagado ao sair. Regras puras
// em session-core.ts. Em produção: HTTPS (cookie seguro) e duas etapas.

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

export async function createSession(userId: string): Promise<void> {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);
  await prisma.session.create({ data: { tokenHash: hashSessionToken(token), userId, expiresAt } });
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
  studentId: string | null;
};

// Uma consulta por requisição, mesmo com layout, página e ação pedindo o usuário.
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { tokenHash: hashSessionToken(token) }, include: { user: true } });
  if (!session) return null;
  const now = new Date();
  if (sessionState(session, now) !== "valida") {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  if (shouldTouchSession(session.lastSeenAt, now)) await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: now } });
  const user = session.user;
  return {
    id: user.id, name: user.name, email: user.email,
    role: user.role, schoolId: user.schoolId, studentId: user.studentId,
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
  if (section) await recordView(user, studentId, section);
  return user;
}

// Dados clínicos do estudo de caso (diagnóstico informado, saúde, acompanhamentos
// externos e com quem mora): só o AEE e a coordenação (seções 7 e 14, necessidade de saber).
export function canSeeClinicalDetail(role: string): boolean {
  return role === "professor_aee" || role === "coordenacao";
}

// Perfis com visão de gestão da rede inteira.
const NETWORK_ROLES = new Set(["secretaria", "gestao", "coordenacao"]);
// Perfis que atuam diretamente sobre o estudante na escola.
const SCHOOL_ROLES = new Set(["professor_sala", "professor_aee", "apoio", "coordenacao", "gestao"]);

export function canAccessStudent(user: SessionUser, studentSchoolId: string, studentId: string): boolean {
  if (user.role === "secretaria") return true;
  if (user.role === "familia" || user.role === "terapeuta") return user.studentId === studentId;
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
  if (!user || !student || !isStaffOrNetwork(user.role) || !canSeePedagogicalDetail(user.role) || !canAccessStudent(user, student.schoolId, student.id)) {
    throw new Error("Você não tem permissão para esta ação com este estudante.");
  }
  return user;
}
