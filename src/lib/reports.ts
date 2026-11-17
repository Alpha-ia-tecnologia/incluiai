import "server-only";
import { notifyFamily } from "./notifications";
import { db } from "./prisma";
import type { SessionUser } from "./auth";
import { can } from "./roles";
import { AUDIT_ACTION, recordChange } from "./audit";
import { bnccSkill } from "./bncc";
import { parseCaseStudy } from "./case-study";
import { splitItems } from "./form-options";
import { DIMENSIONS } from "./scale";
import { brDate, draftOpinion, opinionProblem, supportAt, topItems, type ReportData } from "./period-report";
import { compareAreas } from "./assessment";
import { answersOf } from "./assessments";

const dayStart = (iso: string) => new Date(`${iso}T00:00:00-03:00`);
const dayEnd = (iso: string) => new Date(`${iso}T23:59:59-03:00`);

export async function collectReportData(studentId: string, start: string, end: string): Promise<ReportData> {
  const prisma = await db();
  const from = dayStart(start);
  const to = dayEnd(end);
  const student = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    include: {
      school: { select: { name: true } },
      caseStudy: { select: { status: true, content: true } },
      plans: { where: { createdAt: { lte: to }, OR: [{ closedAt: null }, { closedAt: { gte: from } }] }, include: { objectives: { where: { createdAt: { lte: to } }, orderBy: { createdAt: "asc" } } } },
      diaryEntries: { where: { date: { lte: to } }, select: { date: true, objectiveId: true, supportLevel: true, whatWorked: true, activity: { select: { title: true } } } },
      aeeSessions: { where: { date: { gte: from, lte: to } }, select: { status: true } },
      materials: { where: { status: "aprovado", approvedAt: { gte: from, lte: to } }, select: { title: true }, orderBy: { approvedAt: "asc" } },
      familyNotes: { where: { date: { gte: from, lte: to } }, select: { id: true } },
      intersectorReports: { where: { createdAt: { gte: from, lte: to } }, select: { id: true } },
      consent: { select: { therapistLink: true } },
      assessments: { where: { appliedAt: { lte: to } }, orderBy: { appliedAt: "asc" }, select: { appliedAt: true, answers: true } },
    },
  });
  const inside = student.assessments.filter((item) => item.appliedAt >= from);
  const before = student.assessments.filter((item) => item.appliedAt < from).at(-1) ?? inside[0];
  const assessment = inside.length && before
    ? compareAreas(answersOf(before.answers), answersOf(inside.at(-1)!.answers)).filter((row) => row.start !== null || row.end !== null).map(({ label, start, end }) => ({ label, start, end }))
    : null;
  const inPeriod = student.diaryEntries.filter((entry) => entry.date >= from);
  const caseStudy = parseCaseStudy(student.caseStudy?.content);
  const objectives = student.plans.flatMap((plan) => plan.objectives).map((objective) => {
    const entries = student.diaryEntries.filter((entry) => entry.objectiveId === objective.id);
    const skill = bnccSkill(objective.bnccCode);
    return {
      description: objective.description,
      dimension: DIMENSIONS[objective.dimension] ?? objective.dimension,
      bncc: skill ? { code: skill.code, component: skill.component, description: skill.description } : null,
      status: objective.status,
      supportStart: supportAt(entries, from, objective.currentSupport) ?? objective.currentSupport,
      supportEnd: entries.some((entry) => entry.date >= from) ? supportAt(entries, to, null) : null,
      records: entries.filter((entry) => entry.date >= from).length,
    };
  });
  return {
    version: 1,
    period: { start, end },
    student: { name: student.name, gradeYear: student.gradeYear, className: student.className, school: student.school.name },
    caseStudy: { concluded: student.caseStudy?.status === "concluido", synthesis: caseStudy.sintese?.trim() || null, needs: splitItems(caseStudy.necessidades) },
    objectives,
    aee: {
      done: student.aeeSessions.filter((session) => session.status === "realizado").length,
      absences: student.aeeSessions.filter((session) => session.status === "falta").length,
      cancelled: student.aeeSessions.filter((session) => session.status === "cancelamento").length,
    },
    strategies: topItems(inPeriod.flatMap((entry) => splitItems(entry.whatWorked))),
    activities: [...new Set(inPeriod.flatMap((entry) => (entry.activity ? [entry.activity.title] : [])))].slice(0, 12),
    materials: [...new Set(student.materials.map((material) => material.title))].slice(0, 12),
    familyNotes: student.familyNotes.length,
    therapistReports: student.consent?.therapistLink ? student.intersectorReports.length : 0,
    assessment,
  };
}

export const reportData = (stored: string): ReportData => JSON.parse(stored) as ReportData;
export const periodLabel = (data: Pick<ReportData, "period">) => `${brDate(data.period.start)} a ${brDate(data.period.end)}`;

export async function createReport(user: SessionUser, studentId: string, start: string, end: string) {
  const prisma = await db();
  const data = await collectReportData(studentId, start, end);
  return prisma.studentReport.create({
    data: {
      studentId, periodStart: dayStart(start), periodEnd: dayEnd(end), data: JSON.stringify(data), opinion: draftOpinion(data),
      createdById: user.id, createdByName: user.name, updatedByName: user.name,
    },
  });
}

async function draftFor(studentId: string, reportId: string) {
  const prisma = await db();
  const report = await prisma.studentReport.findFirst({ where: { id: reportId, studentId } });
  if (!report) throw new Error("Relatório não encontrado.");
  if (report.status === "validado") throw new Error("Relatório validado não muda mais.");
  return report;
}

export async function saveOpinion(user: SessionUser, studentId: string, reportId: string, opinion: string) {
  const prisma = await db();
  await draftFor(studentId, reportId);
  await prisma.studentReport.update({ where: { id: reportId }, data: { opinion: opinion.slice(0, 8000), updatedByName: user.name } });
}

export async function refreshReport(user: SessionUser, studentId: string, reportId: string) {
  const prisma = await db();
  const report = await draftFor(studentId, reportId);
  const current = reportData(report.data);
  const data = await collectReportData(studentId, current.period.start, current.period.end);
  await prisma.studentReport.update({ where: { id: reportId }, data: { data: JSON.stringify(data), updatedByName: user.name } });
}

export async function validateReport(user: SessionUser, studentId: string, reportId: string): Promise<string | null> {
  const prisma = await db();
  if (!can(user.role, "validateReports")) return "Quem valida o relatório é o professor do AEE ou a coordenação.";
  const report = await draftFor(studentId, reportId);
  const problem = opinionProblem(report.opinion);
  if (problem) return problem;
  const data = reportData(report.data);
  await prisma.$transaction([
    prisma.studentReport.update({ where: { id: reportId }, data: { status: "validado", validatedById: user.id, validatedByName: user.name, validatedAt: new Date() } }),
    prisma.timelineEvent.create({ data: { studentId, type: "avaliacao", title: "Relatório do período validado", description: `${periodLabel(data)}, por ${user.name}. A família vê no portal.` } }),
  ]);
  await recordChange(user, studentId, AUDIT_ACTION.validated, `Relatório do período (${periodLabel(data)})`);
  await notifyFamily(studentId, "relatorio_validado", `/familia/${studentId}/relatorios/${reportId}`);
  return null;
}

export async function deleteDraft(studentId: string, reportId: string) {
  const prisma = await db();
  await draftFor(studentId, reportId);
  await prisma.studentReport.delete({ where: { id: reportId } });
}
