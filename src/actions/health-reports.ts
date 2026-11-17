"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireStudentTeam, type SessionUser } from "@/lib/auth";
import { can } from "@/lib/roles";
import { recordChange } from "@/lib/access-log";
import { parseCaseStudy } from "@/lib/case-study";
import {
  MAX_REPORT_BYTES, MAX_REPORT_MB, RETRY_STATUSES, cleanReportFileName, mergeIntoCaseStudy, parseReading, sniffReportType, type ReportAccepted,
} from "@/lib/health-report";
import { processHealthReport } from "@/lib/agents/health-report-reader";

export type UploadState = { error?: string };

const reportPath = (studentId: string, reportId?: string) => `/estudantes/${studentId}/estudo-de-caso/laudos${reportId ? `/${reportId}` : ""}`;

async function requireReportTeam(studentId: string): Promise<SessionUser> {
  const user = await requireStudentTeam(studentId);
  if (!can(user.role, "seeClinical")) throw new Error("Laudos ficam visíveis só para o AEE e a coordenação.");
  return user;
}

async function loadReport(reportId: string) {
  const prisma = await db();
  const report = await prisma.healthReport.findUnique({
    where: { id: reportId },
    select: { id: true, studentId: true, status: true, reading: true, reviewedAt: true },
  });
  if (!report) throw new Error("Laudo não encontrado.");
  const user = await requireReportTeam(report.studentId);
  return { report, user };
}

function refresh() {
  revalidatePath("/estudantes/[id]", "layout");
}

export async function uploadHealthReport(studentId: string, _state: UploadState, formData: FormData): Promise<UploadState> {
  const prisma = await db();
  const user = await requireReportTeam(studentId);
  const file = formData.get("arquivo");
  if (!(file instanceof File) || file.size === 0) return { error: "Escolha o arquivo do laudo." };
  if (file.size > MAX_REPORT_BYTES) return { error: `O arquivo tem mais de ${MAX_REPORT_MB} MB. Envie uma versão menor.` };
  if (formData.get("familiaEntregou") !== "on") return { error: "Confirme que a família entregou o documento à escola." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = sniffReportType(bytes);
  if (!mimeType) return { error: "Este arquivo não é PDF, JPG nem PNG. Envie o laudo em um desses formatos." };

  const report = await prisma.healthReport.create({
    data: {
      studentId, mimeType, size: bytes.byteLength, data: bytes,
      fileName: cleanReportFileName(file.name, mimeType),
      uploadedBy: user.name, uploadedRole: user.role,
    },
    select: { id: true },
  });
  await recordChange(user, studentId, "anexou", "Laudo no estudo de caso");
  await processHealthReport(report.id, user);
  refresh();
  redirect(reportPath(studentId, report.id));
}

export async function retryHealthReport(reportId: string) {
  const prisma = await db();
  const { report, user } = await loadReport(reportId);
  if (!report.reviewedAt && RETRY_STATUSES.has(report.status)) {
    await prisma.healthReport.update({ where: { id: reportId }, data: { status: "lendo" } });
    await processHealthReport(reportId, user);
    refresh();
  }
  redirect(reportPath(report.studentId, reportId));
}

export async function reviewHealthReport(reportId: string, formData: FormData) {
  const prisma = await db();
  const { report, user } = await loadReport(reportId);
  const reading = parseReading(report.reading);
  if (report.status !== "lido" || report.reviewedAt || !reading) redirect(reportPath(report.studentId, reportId));

  const accepted: ReportAccepted = { guidance: [], fields: {} };
  if (formData.get("intent") !== "descartar") {
    const chosen = new Set(formData.getAll("orientacao").map(String));
    accepted.guidance = reading.guidance.filter((_, index) => chosen.has(String(index))).map((item) => item.text);
    for (const suggestion of reading.suggestions) {
      const picked = new Set(formData.getAll(`campo:${suggestion.field}`).map(String));
      const values = suggestion.values.filter((value) => picked.has(value));
      if (values.length) accepted.fields[suggestion.field] = values;
    }
  }

  const studentId = report.studentId;
  if (Object.keys(accepted.fields).length > 0) {
    const existing = await prisma.caseStudy.findUnique({ where: { studentId }, select: { content: true } });
    const content = JSON.stringify(mergeIntoCaseStudy(parseCaseStudy(existing?.content), accepted.fields));
    await prisma.caseStudy.upsert({
      where: { studentId },
      create: { studentId, content, updatedBy: user.name },
      update: { content, updatedBy: user.name },
    });
    await recordChange(user, studentId, existing ? "editou" : "criou", "Estudo de caso: informações do laudo");
  }
  await prisma.healthReport.update({ where: { id: reportId }, data: { reviewedBy: user.name, reviewedAt: new Date(), accepted: JSON.stringify(accepted) } });
  await recordChange(user, studentId, "revisou", "Sugestões da leitura do laudo");

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
  refresh();
  revalidatePath("/");
  redirect(`${reportPath(studentId, reportId)}?revisado=1`);
}

export async function deleteHealthReport(reportId: string) {
  const prisma = await db();
  const { report, user } = await loadReport(reportId);
  await prisma.healthReport.delete({ where: { id: reportId } });
  await recordChange(user, report.studentId, "excluiu", "Laudo do estudo de caso");
  refresh();
  redirect(`${reportPath(report.studentId)}?excluido=1`);
}
