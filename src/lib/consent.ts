import "server-only";
import { db } from "./prisma";
import { AUDIT_ACTION, recordChange } from "./audit";
import { invalidateStudent } from "./invalidate";
import { UserError } from "./user-error";
import type { SessionUser } from "./auth";
import { isFamilyOf } from "./policy";
import { syncCardWithConsent } from "./student-card";

export type ConsentField = "aiUse" | "therapistLink" | "card";
const CONSENT_FIELDS: readonly ConsentField[] = ["aiUse", "therapistLink", "card"];
export const CONSENT_LABEL: Record<ConsentField, string> = { aiUse: "Uso de IA", therapistLink: "Conexão com o terapeuta", card: "Carteirinha digital" };

export type StudentConsent = { aiUse: boolean; therapistLink: boolean; card: boolean; updatedAt: Date | null; updatedBy: string | null };

export async function studentConsent(studentId: string): Promise<StudentConsent> {
  const prisma = await db();
  const consent = await prisma.consent.findUnique({ where: { studentId } });
  return { aiUse: consent?.aiUse ?? false, therapistLink: consent?.therapistLink ?? false, card: consent?.card ?? false, updatedAt: consent?.updatedAt ?? null, updatedBy: consent?.updatedBy ?? null };
}

export async function aiConsentAmong(studentIds: string[]): Promise<Set<string>> {
  const prisma = await db();
  const rows = await prisma.consent.findMany({ where: { studentId: { in: studentIds }, aiUse: true }, select: { studentId: true } });
  return new Set(rows.map((row) => row.studentId));
}

const isConsentField = (field: string): field is ConsentField => (CONSENT_FIELDS as readonly string[]).includes(field);

export async function setStudentConsent(user: SessionUser, studentId: string, field: string, value: boolean): Promise<void> {
  const prisma = await db();
  if (!isFamilyOf(user, studentId)) throw new UserError("Só a família do estudante decide as autorizações.", "forbidden");
  if (!isConsentField(field)) throw new UserError("Autorização desconhecida.");
  await prisma.consent.upsert({
    where: { studentId },
    create: { studentId, [field]: value, updatedBy: user.name },
    update: { [field]: value, updatedBy: user.name },
  });
  if (field === "card") await syncCardWithConsent(studentId, value);
  await recordChange(user, studentId, value ? AUDIT_ACTION.authorized : AUDIT_ACTION.revoked, CONSENT_LABEL[field]);
  invalidateStudent(studentId);
}
