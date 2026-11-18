import "server-only";
import { db } from "./prisma";
import { assertStudentTeam, type SessionUser } from "./auth";
import { can } from "./roles";
import { AUDIT_ACTION, recordChange } from "./audit";
import { dateFromInput } from "./form-data";
import { dayEnd, dayStart } from "./dates";
import { UserError } from "./user-error";
import { AEE_SESSION_STATUSES, type AeeSessionStatus } from "./scale";

export type AeeSessionInput = { date: string; status: string; reason: string; note: string };

export async function saveAeeSession(user: SessionUser, studentId: string, input: AeeSessionInput) {
  const prisma = await db();
  await assertStudentTeam(user, studentId);
  if (!can(user.role, "recordAee")) throw new UserError("A frequência do AEE é registrada pelo professor do AEE ou pela coordenação.", "forbidden");
  if (!AEE_SESSION_STATUSES.includes(input.status as AeeSessionStatus)) throw new UserError("Escolha: realizado, falta ou cancelamento.");
  const date = dateFromInput(input.date, "a data do atendimento");
  const reason = input.reason.trim().slice(0, 300);
  if (input.status !== "realizado" && !reason) throw new UserError("Diga o motivo da falta ou do cancelamento.");
  const sameDay = await prisma.aeeSession.findFirst({ where: { studentId, date: { gte: dayStart(input.date), lte: dayEnd(input.date) } }, select: { id: true } });
  const data = { date, status: input.status, reason: input.status === "realizado" ? null : reason, note: input.note.trim().slice(0, 1200) || null, authorId: user.id, authorName: user.name };
  if (sameDay) await prisma.aeeSession.update({ where: { id: sameDay.id }, data });
  else await prisma.aeeSession.create({ data: { ...data, studentId } });
  await recordChange(user, studentId, sameDay ? AUDIT_ACTION.edited : AUDIT_ACTION.created, `Frequência do AEE: ${input.status}`);
}

export async function listAeeSessions(user: SessionUser, studentId: string) {
  const prisma = await db();
  await assertStudentTeam(user, studentId);
  const sessions = await prisma.aeeSession.findMany({ where: { studentId }, orderBy: { date: "desc" }, take: 120 });
  const summary = Object.fromEntries(AEE_SESSION_STATUSES.map((status) => [status, sessions.filter((session) => session.status === status).length])) as Record<AeeSessionStatus, number>;
  return { sessions, summary };
}
