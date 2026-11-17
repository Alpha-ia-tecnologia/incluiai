import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { db, isPlatformArea } from "./prisma";
import { MFA_PENDING_MS, SESSION_MAX_AGE_MS, hashSessionToken, newSessionToken, sessionState, shouldTouchSession } from "./session-core";
import { can, isLinkedRole, isPlatformRole, isRole, type Role } from "./roles";
import { canWorkWithStudent, linkedStudentIds } from "./policy";
import { UserError } from "./user-error";

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

let dummyHash: string | null = null;
export function verifyPasswordOrDummy(password: string, stored: string | null): boolean {
  if (stored) return verifyPassword(password, stored);
  dummyHash ??= hashPassword("incluiedu-conta-inexistente");
  verifyPassword(password, dummyHash);
  return false;
}

export async function createSession(userId: string, { pending = false }: { pending?: boolean } = {}): Promise<void> {
  const prisma = await db();
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + (pending ? MFA_PENDING_MS : SESSION_MAX_AGE_MS));
  await prisma.session.create({ data: { tokenHash: hashSessionToken(token), userId, expiresAt, mfaPending: pending } });
  if (!pending) await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
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

export async function upgradeSession(pendingSessionId: string, userId: string): Promise<void> {
  const prisma = await db();
  await prisma.session.deleteMany({ where: { id: pendingSessionId, mfaPending: true } });
  await createSession(userId);
}

async function sessionFromCookie() {
  const prisma = await db();
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: { include: { studentLinks: { select: { studentId: true }, orderBy: { createdAt: "asc" } } } } },
  });
}

export async function currentSessionId(): Promise<string | null> {
  return (await sessionFromCookie())?.id ?? null;
}

export async function getPendingLogin() {
  const session = await sessionFromCookie();
  if (!session?.mfaPending || session.user.deactivatedAt || sessionState(session) !== "valida") return null;
  return { sessionId: session.id, startedAt: session.createdAt, user: session.user };
}

export function loginStep(user: { role: string; mustChangePassword: boolean; totpEnabledAt: Date | null }): "nova-senha" | "duas-etapas" | null {
  if (user.mustChangePassword) return "nova-senha";
  if (user.totpEnabledAt || twoFactorRequired(user.role)) return "duas-etapas";
  return null;
}

export function twoFactorRequired(role: string): boolean {
  return process.env.REQUIRE_2FA === "1" && can(role, "twoFactor");
}

export async function destroySession(): Promise<void> {
  const prisma = await db();
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  store.delete(SESSION_COOKIE);
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  schoolId: string | null;
  studentIds: string[];
};

const sessionUser = cache(async (): Promise<SessionUser | null> => {
  const prisma = await db();
  const session = await sessionFromCookie();
  if (!session) return null;
  const now = new Date();
  if (sessionState(session, now) !== "valida") {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  if (session.user.deactivatedAt) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  const { user } = session;
  const role = user.role;
  if (!isRole(role) || session.mfaPending || user.mustChangePassword || (twoFactorRequired(role) && !user.totpEnabledAt)) return null;
  if (shouldTouchSession(session.lastSeenAt, now)) await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: now } });
  const linked = isLinkedRole(role);
  if (linked && !user.studentLinks.length && user.studentId) {
    await prisma.studentLink.upsert({
      where: { userId_studentId: { userId: user.id, studentId: user.studentId } },
      create: { userId: user.id, studentId: user.studentId },
      update: {},
    }).catch(() => null);
  }
  return { id: user.id, name: user.name, email: user.email, role, schoolId: user.schoolId, studentIds: linked ? linkedStudentIds(user) : [] };
});

export async function getCurrentUser(): Promise<SessionUser | null> {
  const user = await sessionUser();
  return user && !isPlatformRole(user.role) ? user : null;
}

export async function getPlatformUser(): Promise<SessionUser | null> {
  const user = await sessionUser();
  return user && isPlatformRole(user.role) ? user : null;
}

export async function requirePlatformUser(): Promise<SessionUser> {
  if (!(await isPlatformArea())) notFound();
  const user = await getPlatformUser();
  if (!user) redirect("/login");
  return user;
}

export const NOMINAL_ACCESS_HOURS = 8;
export async function activeGrant(user: SessionUser, studentId: string): Promise<{ expiresAt: Date } | null> {
  const prisma = await db();
  return prisma.accessGrant.findFirst({ where: { userId: user.id, studentId, expiresAt: { gt: new Date() } }, orderBy: { expiresAt: "desc" }, select: { expiresAt: true } });
}

export const studentForbidden = () => new UserError("Você não tem permissão para esta ação com este estudante.", "forbidden");

export async function assertStudentTeam(user: SessionUser, studentId: string) {
  const prisma = await db();
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, name: true, schoolId: true, className: true } });
  if (!student || !canWorkWithStudent(user, student)) throw studentForbidden();
  return student;
}
