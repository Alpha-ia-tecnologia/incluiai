import "server-only";
import { db } from "./prisma";
import { assertStudentTeam, type SessionUser } from "./auth";
import { can } from "./roles";
import { AUDIT_ACTION, recordChange } from "./audit";
import { invalidateStudent } from "./invalidate";
import { requiredUpload } from "./uploads";
import { UserError } from "./user-error";
import { saveCaseStudy } from "./case-studies";
import { REPORT_UPLOAD, acceptedSuggestions, canRetryReading, cleanReportFileName, parseReading, sniffReportType, type ReportStatus, type ReviewChoice } from "./health-report";
import { processHealthReport } from "./agents/health-report-reader";

async function assertReportTeam(user: SessionUser, studentId: string) {
  await assertStudentTeam(user, studentId);
  if (!can(user.role, "seeClinical")) throw new UserError("Laudos ficam visíveis só para o AEE e a coordenação.", "forbidden");
}

async function reportOf(user: SessionUser, reportId: string) {
  const prisma = await db();
  const report = await prisma.healthReport.findUnique({
    where: { id: reportId },
    select: { id: true, studentId: true, status: true, reading: true, privacyNote: true, reviewedAt: true, createdAt: true },
  });
  if (!report) throw new UserError("Laudo não encontrado.", "not_found");
  await assertReportTeam(user, report.studentId);
  return report;
}

export async function uploadHealthReport(user: SessionUser, studentId: string, upload: FormDataEntryValue | null, deliveredByFamily: boolean): Promise<{ id: string }> {
  const prisma = await db();
  await assertReportTeam(user, studentId);
  const file = requiredUpload(upload, REPORT_UPLOAD);
  if (!deliveredByFamily) throw new UserError("Confirme que a família entregou o documento à escola.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = sniffReportType(bytes);
  if (!mimeType) throw new UserError("Este arquivo não é PDF, JPG nem PNG. Envie o laudo em um desses formatos.");
  const report = await prisma.healthReport.create({
    data: {
      studentId, mimeType, size: bytes.byteLength, data: bytes,
      fileName: cleanReportFileName(file.name, mimeType),
      uploadedBy: user.name, uploadedRole: user.role,
    },
    select: { id: true },
  });
  await recordChange(user, studentId, AUDIT_ACTION.attached, "Laudo no estudo de caso");
  await processHealthReport(report.id, user);
  invalidateStudent(studentId);
  return report;
}

export async function retryHealthReport(user: SessionUser, reportId: string): Promise<{ studentId: string }> {
  const prisma = await db();
  const report = await reportOf(user, reportId);
  if (canRetryReading(report)) {
    await prisma.healthReport.update({ where: { id: reportId }, data: { status: "lendo" satisfies ReportStatus } });
    await processHealthReport(reportId, user);
    invalidateStudent(report.studentId);
  }
  return report;
}

export async function reviewHealthReport(user: SessionUser, reportId: string, choice: ReviewChoice | null): Promise<{ studentId: string; reviewed: boolean }> {
  const prisma = await db();
  const report = await reportOf(user, reportId);
  const reading = parseReading(report.reading);
  const { studentId } = report;
  if (report.status !== "lido" || report.reviewedAt || !reading) return { studentId, reviewed: false };

  const accepted = acceptedSuggestions(reading, choice);
  if (Object.keys(accepted.fields).length > 0) await saveCaseStudy(user, studentId, { reportFields: accepted.fields });
  await prisma.healthReport.update({ where: { id: reportId }, data: { reviewedBy: user.name, reviewedAt: new Date(), accepted: JSON.stringify(accepted) } });
  await recordChange(user, studentId, AUDIT_ACTION.reviewed, "Sugestões da leitura do laudo");

  const joined = Object.values(accepted.fields).reduce((total, values) => total + (values?.length ?? 0), 0);
  if (joined + accepted.guidance.length > 0) {
    await prisma.timelineEvent.create({
      data: {
        studentId, type: "avaliacao", title: "Laudo revisado pela equipe",
        description: [
          joined ? `${joined} ${joined === 1 ? "informação juntada" : "informações juntadas"} ao estudo de caso` : null,
          accepted.guidance.length ? `${accepted.guidance.length} ${accepted.guidance.length === 1 ? "orientação" : "orientações"} para a escola` : null,
        ].filter(Boolean).join(" e ") + ".",
      },
    });
  }
  invalidateStudent(studentId);
  return { studentId, reviewed: true };
}

export async function deleteHealthReport(user: SessionUser, reportId: string): Promise<{ studentId: string }> {
  const prisma = await db();
  const report = await reportOf(user, reportId);
  await prisma.healthReport.delete({ where: { id: reportId } });
  await recordChange(user, report.studentId, AUDIT_ACTION.deleted, "Laudo do estudo de caso");
  invalidateStudent(report.studentId);
  return report;
}
