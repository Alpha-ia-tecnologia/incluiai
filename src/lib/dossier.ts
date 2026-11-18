import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./prisma";
import { parseCaseStudy } from "./case-study";
import { censusMetaOf } from "./census";
import { RECENT_AEE_DAYS, RECENT_DIARY_DAYS, evidenceGroups, evidenceSummary, type EvidenceGroup } from "./evidence";
import { DAY_MS } from "./dates";
import { PLAN_DOCUMENT_KEYS, type PlanDocumentKey } from "./plan-documents";

const PLAN_DOCUMENT_SELECT = Object.fromEntries(PLAN_DOCUMENT_KEYS.map((key) => [key, true])) as Record<PlanDocumentKey, true>;

export type StudentEvidence = { id: string; name: string; className: string; schoolId: string; school: string; groups: EvidenceGroup[]; summary: ReturnType<typeof evidenceSummary> };

export async function loadEvidence(where: Prisma.StudentWhereInput, now: Date = new Date()): Promise<StudentEvidence[]> {
  const prisma = await db();
  const students = await prisma.student.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, className: true, schoolId: true, school: { select: { name: true } }, census: true,
      caseStudy: { select: { status: true, concludedAt: true, content: true } },
      plans: {
        where: { status: "ativo" }, orderBy: { createdAt: "desc" }, take: 1,
        select: {
          createdAt: true, reviewedAt: true, reviewDate: true, _count: { select: { objectives: true } }, ...PLAN_DOCUMENT_SELECT,
        },
      },
      aeeSessions: { where: { date: { gte: new Date(now.getTime() - RECENT_AEE_DAYS * DAY_MS), lte: now } }, select: { status: true } },
      reports: { where: { status: "validado" }, orderBy: { validatedAt: "desc" }, take: 1, select: { validatedAt: true } },
      assessments: { orderBy: { appliedAt: "desc" }, take: 1, select: { appliedAt: true } },
      consent: { select: { aiUse: true, therapistLink: true, updatedBy: true, updatedAt: true } },
      _count: { select: { adaptedTasks: { where: { status: "aprovada" } }, diaryEntries: { where: { date: { gte: new Date(now.getTime() - RECENT_DIARY_DAYS * DAY_MS) } } } } },
    },
  });
  return students.map((student) => {
    const plan = student.plans[0];
    const sessions = (status: string) => student.aeeSessions.filter((session) => session.status === status).length;
    const groups = evidenceGroups({
      now,
      caseStudy: student.caseStudy ? { status: student.caseStudy.status, concludedAt: student.caseStudy.concludedAt, content: parseCaseStudy(student.caseStudy.content) } : null,
      plan: plan ? { ...plan, objectives: plan._count.objectives } : null,
      approvedAdaptations: student._count.adaptedTasks,
      diaryRecent: student._count.diaryEntries,
      aee: { done: sessions("realizado"), absences: sessions("falta"), cancelled: sessions("cancelamento") },
      lastReportAt: student.reports[0]?.validatedAt ?? null,
      assessmentAt: student.assessments[0]?.appliedAt ?? null,
      census: censusMetaOf(student.census),
      consent: student.consent ? { aiUse: student.consent.aiUse, therapistLink: student.consent.therapistLink, decidedAt: student.consent.updatedBy ? student.consent.updatedAt : null } : null,
    });
    return { id: student.id, name: student.name, className: student.className, schoolId: student.schoolId, school: student.school.name, groups, summary: evidenceSummary(groups) };
  });
}
