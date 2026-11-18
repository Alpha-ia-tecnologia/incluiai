import "server-only";
import { db } from "./prisma";
import { publicAddress } from "./network";
import type { SessionUser } from "./auth";
import { isFamilyOf } from "./policy";
import { emailConfigured, sendEmail } from "./email";
import { cleanCheckIn, noticeEmail, noticeTitle, type NoticeKind } from "./family-contact";
import { DAY_MS, weekStart } from "./dates";
import { familyRecipients, schoolRecipients, writeNotices, type Recipient } from "./notices";
import { UserError } from "./user-error";
import { firstName, writeList } from "./format";
import { invalidateStudent } from "./invalidate";

const firstNameOf = async (studentId: string) => {
  const prisma = await db();
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { name: true } });
  return student ? firstName(student.name) : "o estudante";
};

async function deliver(recipients: Recipient[], studentId: string, kind: NoticeKind, href: string) {
  if (!recipients.length) return;
  await writeNotices(recipients, { studentId, kind, title: noticeTitle(kind, await firstNameOf(studentId)), href });
  if (!emailConfigured()) return;
  const { subject, text } = noticeEmail(await publicAddress());
  await Promise.all(recipients.filter((recipient) => recipient.notifyByEmail).map((recipient) => sendEmail(recipient.email, subject, text)));
}

export async function notifyFamily(studentId: string, kind: NoticeKind, href: string) {
  await deliver(await familyRecipients(studentId), studentId, kind, href);
}

export async function notifyTeam(studentId: string, kind: NoticeKind, href: string) {
  const prisma = await db();
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { schoolId: true } });
  if (!student) return;
  await deliver(await schoolRecipients(student.schoolId, "teamNotices"), studentId, kind, href);
}

export async function unreadNotices(userId: string): Promise<{ unread: number; latest: string | null }> {
  const prisma = await db();
  const where = { userId, readAt: null };
  const [unread, latest] = await Promise.all([prisma.notification.count({ where }), prisma.notification.findFirst({ where, orderBy: { createdAt: "desc" }, select: { id: true } })]);
  return { unread, latest: latest?.id ?? null };
}

export async function readNotices(user: SessionUser) {
  const prisma = await db();
  const [notices, prefs] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { notifyByEmail: true, weeklyCheckIn: true } }),
  ]);
  const unread = new Set(notices.filter((notice) => !notice.readAt).map((notice) => notice.id));
  if (unread.size) await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  return { notices, unread, prefs };
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
  const fields = { userId: user.id, authorName: user.name, answers: writeList(clean.answers), note: clean.note };
  if (await prisma.familyCheckIn.findUnique({ where: key, select: { id: true } })) {
    await prisma.familyCheckIn.update({ where: key, data: fields });
    invalidateStudent(studentId);
    return;
  }
  await prisma.familyCheckIn.create({ data: { studentId, weekStart: week, ...fields } });
  await prisma.timelineEvent.create({ data: { studentId, type: "familia", title: "A família contou como foi a semana", description: [clean.answers.join(", "), clean.note].filter(Boolean).join(". ").slice(0, 400) } });
  await notifyTeam(studentId, "checkin_respondido", `/estudantes/${studentId}/diario`);
  invalidateStudent(studentId);
}

export const recentCheckIn = async (studentId: string) => {
  const prisma = await db();
  return prisma.familyCheckIn.findFirst({ where: { studentId, weekStart: { gte: weekStart(new Date(Date.now() - 7 * DAY_MS)) } }, orderBy: { createdAt: "desc" } });
};
