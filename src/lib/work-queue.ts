import "server-only";
import { db } from "./prisma";
import type { SessionUser } from "./auth";
import { studentScopeWhere } from "./policy";
import { can } from "./roles";
import { studentAlerts } from "./insights";
import { buildQueue, queueSince, type Queue } from "./work-queue-core";

const RECENT_ENTRIES = 40;

export async function loadWorkQueue(user: SessionUser, now: Date = new Date()): Promise<{ queue: Queue; students: number }> {
  const prisma = await db();
  const since = queueSince(now);
  const scoped = { status: "ativo", ...studentScopeWhere(user) };
  const inScope = { student: scoped };
  const [students, records, familyNotes, checkIns, guidance, suggestions, planDrafts] = await Promise.all([
    prisma.student.findMany({
      where: scoped,
      select: {
        id: true, name: true, createdAt: true,
        caseStudy: { select: { status: true, updatedAt: true } },
        plans: { where: { status: "ativo" }, orderBy: { createdAt: "desc" }, take: 1, include: { objectives: true } },
        diaryEntries: { orderBy: { date: "desc" }, take: RECENT_ENTRIES },
      },
      orderBy: { name: "asc" },
    }),
    prisma.diaryEntry.findMany({
      where: { ...inScope, date: { gte: since }, OR: [{ authorId: null }, { authorId: { not: user.id } }] },
      select: { studentId: true, date: true, authorName: true },
    }),
    prisma.familyNote.findMany({ where: { ...inScope, date: { gte: since } }, select: { studentId: true, date: true, author: true, note: true } }),
    prisma.familyCheckIn.findMany({ where: { ...inScope, createdAt: { gte: since } }, select: { studentId: true, createdAt: true, authorName: true } }),
    prisma.intersectorReport.findMany({ where: { ...inScope, createdAt: { gte: since } }, select: { studentId: true, createdAt: true, authorName: true } }),
    prisma.activity.findMany({ where: { ...inScope, status: "sugerida" }, select: { studentId: true, createdAt: true } }),
    prisma.planDraft.findMany({ where: inScope, select: { studentId: true, createdAt: true } }),
  ]);
  const queue = buildQueue({
    students: students.map((student) => {
      const plan = student.plans[0] ?? null;
      return {
        id: student.id,
        name: student.name,
        createdAt: student.createdAt,
        alerts: studentAlerts({ plans: student.plans, entries: student.diaryEntries, now }),
        reviewDate: plan?.reviewDate ?? null,
        caseStudy: student.caseStudy,
        hasPlan: Boolean(plan),
        hasRecord: student.diaryEntries.length > 0,
      };
    }),
    records: records.map((record) => ({ studentId: record.studentId, date: record.date, author: record.authorName })),
    familyNotes,
    checkIns: checkIns.map((item) => ({ studentId: item.studentId, date: item.createdAt, author: item.authorName })),
    guidance: guidance.map((item) => ({ studentId: item.studentId, date: item.createdAt, author: item.authorName })),
    suggestions: suggestions.map((item) => ({ studentId: item.studentId, date: item.createdAt })),
    planDrafts: planDrafts.map((item) => ({ studentId: item.studentId, date: item.createdAt })),
  }, { now, nominal: can(user.role, "seeNames") });
  return { queue, students: students.length };
}
