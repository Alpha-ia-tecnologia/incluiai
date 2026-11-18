import { accountSchool, assignableRoles, isLinkedRole, isRole } from "./roles.ts";

export type AccountManager = { id: string; role: string; schoolId: string | null };
export type ManagedAccount = { id: string; role: string; schoolId: string | null; linkedSchoolIds: string[] };

export function canManageAccount(manager: AccountManager, target: ManagedAccount): boolean {
  if (target.id === manager.id) return false;
  if (!isRole(target.role) || !assignableRoles(manager.role).includes(target.role)) return false;
  if (!manager.schoolId) return true;
  return isLinkedRole(target.role) ? target.linkedSchoolIds.includes(manager.schoolId) : target.schoolId === manager.schoolId;
}

export function accountSchoolProblem(manager: AccountManager, role: string, schoolId: string | null): string | null {
  if (isLinkedRole(role)) return schoolId ? "Família e terapeuta são vinculados a estudantes, não a uma escola." : null;
  const school = accountSchool(role);
  if (school === "nenhuma") return schoolId ? "A Secretaria é da rede, sem escola." : null;
  if (manager.schoolId && schoolId !== manager.schoolId) return "Você cria contas só na sua escola.";
  if (!schoolId && school === "obrigatoria") return "Escolha a escola.";
  return null;
}

export function mergeLinks(
  manager: AccountManager,
  current: ReadonlyArray<{ studentId: string; schoolId: string }>,
  chosen: ReadonlyArray<{ studentId: string; schoolId: string }>,
): string[] {
  const mine = (link: { schoolId: string }) => !manager.schoolId || link.schoolId === manager.schoolId;
  const kept = current.filter((link) => !mine(link)).map((link) => link.studentId);
  const added = chosen.filter(mine).map((link) => link.studentId);
  return [...new Set([...kept, ...added])];
}

export const sameLinks = (a: readonly string[], b: readonly string[]): boolean => [...a].sort().join() === [...b].sort().join();

export type AccountAccess = { email: string; role: string; schoolId: string | null; studentIds: readonly string[] };

export const accessChanged = (before: AccountAccess, after: AccountAccess): boolean =>
  before.email !== after.email || before.role !== after.role || before.schoolId !== after.schoolId || !sameLinks(before.studentIds, after.studentIds);

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Senha nova: comprimento conta mais que regras de símbolo (NIST 800-63B).
const COMMON = new Set(["1234567890", "0123456789", "12345678910", "senha12345", "senhasenha", "qwertyuiop", "abcdefghij", "incluiedu1", "incluiedu123", "escola1234", "professor1"]);
export const PASSWORD_MIN = 10;
export function passwordProblem(password: string, { email = "", name = "" }: { email?: string; name?: string } = {}): string | null {
  if (password.length < PASSWORD_MIN) return `Use pelo menos ${PASSWORD_MIN} caracteres. Uma frase curta é mais fácil de lembrar.`;
  if (password.length > 128) return "Use no máximo 128 caracteres.";
  const lower = password.toLowerCase();
  if (/^(.)\1+$/.test(password) || COMMON.has(lower)) return "Essa senha é fácil de adivinhar. Escolha outra.";
  const local = email.split("@")[0].toLowerCase();
  if (local.length >= 4 && lower.includes(local)) return "Não use o seu e-mail na senha.";
  const words = name.toLowerCase().split(/\s+/).map((part) => part.replace(/[()]/g, "")).filter((part) => /^\p{L}{4,}$/u.test(part));
  if (words.some((word) => lower.includes(word))) return "Não use o seu nome na senha.";
  return null;
}

const TEMP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
function randomIndex(size: number): number {
  const limit = 256 - (256 % size);
  const byte = new Uint8Array(1);
  do crypto.getRandomValues(byte); while (byte[0] >= limit);
  return byte[0] % size;
}

export const TEMPORARY_PASSWORD_PATTERN = new RegExp(`^[${TEMP_ALPHABET}]{4}-[${TEMP_ALPHABET}]{4}-[${TEMP_ALPHABET}]{4}$`);

export function temporaryPassword(): string {
  const chars = Array.from({ length: 12 }, () => TEMP_ALPHABET[randomIndex(TEMP_ALPHABET.length)]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8).join("")}`;
}
