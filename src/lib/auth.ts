import "server-only";
import { cookies } from "next/headers";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma";

// Autenticação da demonstração — item 7 (perfis de acesso) e 14 (LGPD).
// Sessão em cookie httpOnly assinado por HMAC; senha com scrypt + sal.
// Em produção: usar provedor de identidade, criptografia em repouso e rotação.

const SESSION_COOKIE = "incluiedu_session";
const SECRET = process.env.SESSION_SECRET ?? "incluiedu-dev-secret-troque-em-producao";

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

function sign(userId: string): string {
  const mac = createHmac("sha256", SECRET).update(userId).digest("hex");
  return `${userId}.${mac}`;
}

function unsign(token: string): string | null {
  const [userId, mac] = token.split(".");
  if (!userId || !mac) return null;
  const expected = createHmac("sha256", SECRET).update(userId).digest("hex");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

export async function createSession(userId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, sign(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
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

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = unsign(token);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return {
    id: user.id, name: user.name, email: user.email,
    role: user.role, schoolId: user.schoolId, studentId: user.studentId,
  };
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
