import "server-only";
import { db } from "./prisma";
import { AUDIT_ACTION, recordChange } from "./audit";
import type { SessionUser } from "./auth";
import { isFamilyOf } from "./policy";
import { newCardToken } from "./student-card-core";

export type ConsentField = "aiUse" | "therapistLink" | "card";
export const CONSENT_FIELDS: readonly ConsentField[] = ["aiUse", "therapistLink", "card"];
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

export async function setStudentConsent(user: SessionUser, studentId: string, field: ConsentField, value: boolean): Promise<void> {
  const prisma = await db();
  if (!isFamilyOf(user, studentId)) throw new Error("Só a família do estudante decide as autorizações.");
  await prisma.consent.upsert({
    where: { studentId },
    create: { studentId, [field]: value, updatedBy: user.name },
    update: { [field]: value, updatedBy: user.name },
  });
  if (field === "card") {
    if (value) await prisma.studentCard.upsert({ where: { studentId }, create: { studentId, token: newCardToken() }, update: {} });
    else await prisma.studentCard.deleteMany({ where: { studentId } });
  }
  await recordChange(user, studentId, value ? AUDIT_ACTION.authorized : AUDIT_ACTION.revoked, CONSENT_LABEL[field]);
}
