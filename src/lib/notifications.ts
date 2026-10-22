import "server-only";
import { prisma } from "./prisma";
import type { SessionUser } from "./auth";
import { emailConfigured, sendEmail } from "./email";
import { cleanCheckIn, noticeEmail, noticeTitle, weekStart, type NoticeKind } from "./family-contact";

// Avisos no portal e pergunta da semana (item 6). Regras puras em family-contact.ts.

const appUrl = () => process.env.APP_URL?.trim() || "http://localhost:3000";
const firstNameOf = async (studentId: string) => (await prisma.student.findUnique({ where: { id: studentId }, select: { name: true } }))?.name.split(" ")[0] ?? "o estudante";

async function deliver(users: { id: string; email: string; notifyByEmail: boolean; deactivatedAt: Date | null }[], studentId: string, kind: NoticeKind, href: string) {
  const active = users.filter((user) => !user.deactivatedAt);
  if (!active.length) return;
  const title = noticeTitle(kind, await firstNameOf(studentId));
  await prisma.notification.createMany({ data: active.map((user) => ({ userId: user.id, studentId, kind, title, href })) });
  if (!emailConfigured()) return;
  const { subject, text } = noticeEmail(appUrl());
  await Promise.all(active.filter((user) => user.notifyByEmail).map((user) => sendEmail(user.email, subject, text)));
}

const userFields = { id: true, email: true, notifyByEmail: true, deactivatedAt: true } as const;

// Família (contas vinculadas ao estudante).
export async function notifyFamily(studentId: string, kind: NoticeKind, href: string) {
  const users = await prisma.user.findMany({ where: { role: "familia", studentLinks: { some: { studentId } } }, select: userFields });
  await deliver(users, studentId, kind, href);
}

// Equipe que acompanha o estudante: AEE e coordenação da escola dele.
export async function notifyTeam(studentId: string, kind: NoticeKind, href: string) {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { schoolId: true } });
  if (!student) return;
  const users = await prisma.user.findMany({ where: { role: { in: ["professor_aee", "coordenacao"] }, schoolId: student.schoolId }, select: userFields });
  await deliver(users, studentId, kind, href);
}

// Para o sino: quantos avisos novos e o mais recente deles.
export async function unreadNotices(userId: string): Promise<{ unread: number; latest: string | null }> {
  const where = { userId, readAt: null };
  const [unread, latest] = await Promise.all([prisma.notification.count({ where }), prisma.notification.findFirst({ where, orderBy: { createdAt: "desc" }, select: { id: true } })]);
  return { unread, latest: latest?.id ?? null };
}

export async function saveCheckIn(user: SessionUser, studentId: string, answers: string[], note: string): Promise<string | null> {
  if (user.role !== "familia" || !user.studentIds.includes(studentId)) return "Só a família do estudante responde a pergunta da semana.";
  const clean = cleanCheckIn(answers, note);
  if ("error" in clean) return clean.error;
  const week = weekStart();
  const key = { studentId_weekStart: { studentId, weekStart: week } };
  const fields = { userId: user.id, authorName: user.name, answers: JSON.stringify(clean.answers), note: clean.note };
  // Mudar a resposta da semana só atualiza: a linha do tempo e o aviso à equipe ficam com a primeira.
  if (await prisma.familyCheckIn.findUnique({ where: key, select: { id: true } })) {
    await prisma.familyCheckIn.update({ where: key, data: fields });
    return null;
  }
  await prisma.familyCheckIn.create({ data: { studentId, weekStart: week, ...fields } });
  await prisma.timelineEvent.create({ data: { studentId, type: "familia", title: "A família contou como foi a semana", description: [clean.answers.join(", "), clean.note].filter(Boolean).join(". ").slice(0, 400) } });
  await notifyTeam(studentId, "checkin_respondido", `/estudantes/${studentId}/diario`);
  return null;
}

// A resposta mais recente desta semana ou da anterior (a da sexta ainda serve na segunda).
export const recentCheckIn = (studentId: string) =>
  prisma.familyCheckIn.findFirst({ where: { studentId, weekStart: { gte: weekStart(new Date(Date.now() - 7 * 86_400_000)) } }, orderBy: { createdAt: "desc" } });
