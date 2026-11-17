import "server-only";
import { currentTenant, db } from "./prisma";
import { addressOf } from "./tenant";
import type { SessionUser } from "./auth";
import { isFamilyOf } from "./policy";
import { rolesWith } from "./roles";
import { emailConfigured, sendEmail } from "./email";
import { cleanCheckIn, noticeEmail, noticeTitle, weekStart, type NoticeKind } from "./family-contact";
import { UserError } from "./user-error";

const appUrl = async () => {
  const tenant = await currentTenant();
  return tenant.kind === "municipio" ? addressOf(tenant.slug) : process.env.APP_URL?.trim() || "http://localhost:3000";
};
const firstNameOf = async (studentId: string) => {
  const prisma = await db();
  return (await prisma.student.findUnique({ where: { id: studentId }, select: { name: true } }))?.name.split(" ")[0] ?? "o estudante";
};

async function deliver(users: { id: string; email: string; notifyByEmail: boolean; deactivatedAt: Date | null }[], studentId: string, kind: NoticeKind, href: string) {
  const prisma = await db();
  const active = users.filter((user) => !user.deactivatedAt);
  if (!active.length) return;
  const title = noticeTitle(kind, await firstNameOf(studentId));
  await prisma.notification.createMany({ data: active.map((user) => ({ userId: user.id, studentId, kind, title, href })) });
  if (!emailConfigured()) return;
  const { subject, text } = noticeEmail(await appUrl());
  await Promise.all(active.filter((user) => user.notifyByEmail).map((user) => sendEmail(user.email, subject, text)));
}

const userFields = { id: true, email: true, notifyByEmail: true, deactivatedAt: true } as const;

export async function notifyFamily(studentId: string, kind: NoticeKind, href: string) {
  const prisma = await db();
  const users = await prisma.user.findMany({ where: { role: { in: rolesWith("familyPortal") }, studentLinks: { some: { studentId } } }, select: userFields });
  await deliver(users, studentId, kind, href);
}

export async function notifyTeam(studentId: string, kind: NoticeKind, href: string) {
  const prisma = await db();
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { schoolId: true } });
  if (!student) return;
  const users = await prisma.user.findMany({ where: { role: { in: rolesWith("teamNotices") }, schoolId: student.schoolId }, select: userFields });
  await deliver(users, studentId, kind, href);
}

export async function unreadNotices(userId: string): Promise<{ unread: number; latest: string | null }> {
  const prisma = await db();
  const where = { userId, readAt: null };
  const [unread, latest] = await Promise.all([prisma.notification.count({ where }), prisma.notification.findFirst({ where, orderBy: { createdAt: "desc" }, select: { id: true } })]);
  return { unread, latest: latest?.id ?? null };
}

export async function saveNoticePrefs(user: SessionUser, prefs: { notifyByEmail: boolean; weeklyCheckIn: boolean }): Promise<void> {
  const prisma = await db();
  await prisma.user.update({ where: { id: user.id }, data: prefs });
}

export async function saveCheckIn(user: SessionUser, studentId: string, answers: string[], note: string): Promise<void> {
  const prisma = await db();
  if (!isFamilyOf(user, studentId)) throw new UserError("Só a família do estudante responde a pergunta da semana.", "forbidden");
  const clean = cleanCheckIn(answers, note);
  if ("error" in clean) throw new UserError(clean.error);
  const week = weekStart();
  const key = { studentId_weekStart: { studentId, weekStart: week } };
  const fields = { userId: user.id, authorName: user.name, answers: JSON.stringify(clean.answers), note: clean.note };
  if (await prisma.familyCheckIn.findUnique({ where: key, select: { id: true } })) {
    await prisma.familyCheckIn.update({ where: key, data: fields });
    return;
  }
  await prisma.familyCheckIn.create({ data: { studentId, weekStart: week, ...fields } });
  await prisma.timelineEvent.create({ data: { studentId, type: "familia", title: "A família contou como foi a semana", description: [clean.answers.join(", "), clean.note].filter(Boolean).join(". ").slice(0, 400) } });
  await notifyTeam(studentId, "checkin_respondido", `/estudantes/${studentId}/diario`);
}

export const recentCheckIn = async (studentId: string) => {
  const prisma = await db();
  return prisma.familyCheckIn.findFirst({ where: { studentId, weekStart: { gte: weekStart(new Date(Date.now() - 7 * 86_400_000)) } }, orderBy: { createdAt: "desc" } });
};
