import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { parseCaseStudy } from "./case-study";
import { evidenceGroups, evidenceSummary, type EvidenceGroup } from "./evidence";

// Dossiê de evidências (item 8): junta, por estudante, os registros que as
// regras de evidence.ts conferem. Uma consulta para a escola inteira.

const DAY = 86_400_000;

export type StudentEvidence = { id: string; name: string; className: string; schoolId: string; school: string; groups: EvidenceGroup[]; summary: ReturnType<typeof evidenceSummary> };

export async function loadEvidence(where: Prisma.StudentWhereInput, now: Date = new Date()): Promise<StudentEvidence[]> {
  const students = await prisma.student.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, className: true, schoolId: true, school: { select: { name: true } },
      caseStudy: { select: { status: true, concludedAt: true, content: true } },
      plans: {
        where: { status: "ativo" }, orderBy: { createdAt: "desc" }, take: 1,
        select: { createdAt: true, reviewedAt: true, reviewDate: true, commonRoomStrategies: true, aeeStrategies: true, accessibilityResources: true, _count: { select: { objectives: true } } },
      },
      aeeSessions: { where: { date: { gte: new Date(now.getTime() - 30 * DAY), lte: now } }, select: { status: true } },
      reports: { where: { status: "validado" }, orderBy: { validatedAt: "desc" }, take: 1, select: { validatedAt: true } },
      assessments: { orderBy: { appliedAt: "desc" }, take: 1, select: { appliedAt: true } },
      consent: { select: { aiUse: true, therapistLink: true, updatedBy: true, updatedAt: true } },
      _count: { select: { adaptedTasks: { where: { status: "aprovada" } }, diaryEntries: { where: { date: { gte: new Date(now.getTime() - 60 * DAY) } } } } },
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
      // Sem quem decidiu, a linha veio de antes das autorizações: a família ainda não escolheu.
      consent: student.consent ? { aiUse: student.consent.aiUse, therapistLink: student.consent.therapistLink, decidedAt: student.consent.updatedBy ? student.consent.updatedAt : null } : null,
    });
    return { id: student.id, name: student.name, className: student.className, schoolId: student.schoolId, school: student.school.name, groups, summary: evidenceSummary(groups) };
  });
}
