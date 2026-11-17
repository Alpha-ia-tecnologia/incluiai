import "server-only";
import { db } from "./prisma";
import { NOMINAL_ACCESS_HOURS, type SessionUser } from "./auth";
import { AUDIT_ACTION, recordChange } from "./audit";
import { canAccessStudent } from "./policy";
import { can } from "./roles";
import { UserError } from "./user-error";

export async function grantNominalAccess(user: SessionUser, studentId: string, request: { reason: string; detail: string }): Promise<void> {
  const prisma = await db();
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, schoolId: true } });
  if (!student || !canAccessStudent(user, student)) throw new UserError("Estudante não encontrado no seu acesso.", "not_found");
  if (can(user.role, "seeNames")) return;
  if (!request.reason) throw new UserError("Escolha o motivo do acesso.");
  if (request.detail.length < 10) throw new UserError("Descreva o motivo em pelo menos uma frase.");
  const text = `${request.reason}: ${request.detail}`.slice(0, 300);
  await prisma.accessGrant.create({ data: { userId: user.id, studentId, reason: text, expiresAt: new Date(Date.now() + NOMINAL_ACCESS_HOURS * 60 * 60 * 1000) } });
  await recordChange(user, studentId, AUDIT_ACTION.justifiedAccess, text);
}
