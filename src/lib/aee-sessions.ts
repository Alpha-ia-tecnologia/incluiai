import "server-only";
import { prisma } from "./prisma";
import type { SessionUser } from "./auth";
import { assertStudentTeam } from "./records";
import { AEE_SESSION_STATUSES, type AeeSessionStatus } from "./dua/domain";

// Frequência do AEE (descritivo DUA, seção 5 e CA10): realizado, falta ou
// cancelamento. É informação distinta de usar um recurso ou alcançar um objetivo:
// nada aqui cria registro de aula, evidência ou conclusão sobre aprendizagem.

export type AeeSessionInput = { date: string; status: string; reason: string; note: string };

const SESSION_ROLES = new Set(["professor_aee", "coordenacao", "gestao"]);

export const canRecordAeeSession = (user: Pick<SessionUser, "role">) => SESSION_ROLES.has(user.role);

export async function saveAeeSession(user: SessionUser, studentId: string, input: AeeSessionInput) {
  await assertStudentTeam(user, studentId);
  if (!canRecordAeeSession(user)) throw new Error("A frequência do AEE é registrada pelo professor do AEE ou pela coordenação.");
  if (!AEE_SESSION_STATUSES.includes(input.status as AeeSessionStatus)) throw new Error("Escolha: realizado, falta ou cancelamento.");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? new Date(`${input.date}T12:00:00`) : new Date(Number.NaN);
  if (Number.isNaN(date.getTime())) throw new Error("Informe a data do atendimento.");
  const reason = input.reason.trim().slice(0, 300);
  if (input.status !== "realizado" && !reason) throw new Error("Diga o motivo da falta ou do cancelamento.");
  // Um registro por estudante e dia: registrar de novo corrige, não duplica.
  const sameDay = await prisma.aeeSession.findFirst({ where: { studentId, date: { gte: new Date(`${input.date}T00:00:00`), lte: new Date(`${input.date}T23:59:59`) } }, select: { id: true } });
  const data = { date, status: input.status, reason: input.status === "realizado" ? null : reason, note: input.note.trim().slice(0, 1200) || null, authorId: user.id, authorName: user.name };
  if (sameDay) await prisma.aeeSession.update({ where: { id: sameDay.id }, data });
  else await prisma.aeeSession.create({ data: { ...data, studentId } });
  await prisma.accessLog.create({ data: { studentId, actor: user.name, role: user.role, action: sameDay ? "editou" : "criou", detail: `Frequência do AEE: ${input.status}` } });
}

export async function listAeeSessions(user: SessionUser, studentId: string) {
  await assertStudentTeam(user, studentId);
  const sessions = await prisma.aeeSession.findMany({ where: { studentId }, orderBy: { date: "desc" }, take: 120 });
  const summary = Object.fromEntries(AEE_SESSION_STATUSES.map((status) => [status, sessions.filter((session) => session.status === status).length])) as Record<AeeSessionStatus, number>;
  return { sessions, summary };
}
