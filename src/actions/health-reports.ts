"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStudentTeam } from "@/lib/auth";
import { parseCaseStudy } from "@/lib/case-study";
import {
  MAX_REPORT_BYTES, MAX_REPORT_MB, cleanReportFileName, mergeIntoCaseStudy, parseReading, sniffReportType, type ReportAccepted,
} from "@/lib/health-report";
import { processHealthReport } from "@/lib/agents/health-report-reader";

export type UploadState = { error?: string };

const reportPath = (studentId: string, reportId?: string) => `/estudantes/${studentId}/estudo-de-caso/laudos${reportId ? `/${reportId}` : ""}`;

function refresh() {
  revalidatePath("/estudantes/[id]", "layout");
}

async function loadReport(reportId: string) {
  const report = await prisma.healthReport.findUnique({
    where: { id: reportId },
    select: { id: true, studentId: true, status: true, reading: true, reviewedAt: true },
  });
  if (!report) throw new Error("Laudo não encontrado.");
  const user = await requireStudentTeam(report.studentId);
  return { report, user };
}

// Guarda o laudo e pede a leitura pela IA. O arquivo fica guardado mesmo
// quando a leitura não acontece (foto, PDF escaneado, IA desligada ou erro).
export async function uploadHealthReport(studentId: string, _state: UploadState, formData: FormData): Promise<UploadState> {
  const user = await requireStudentTeam(studentId);
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
  await prisma.accessLog.create({ data: { studentId, actor: user.name, role: user.role, action: "criou", detail: "Laudo anexado ao estudo de caso" } });
  await processHealthReport(report.id);
  refresh();
  redirect(reportPath(studentId, report.id));
}

// Nova tentativa de leitura, quando a anterior não terminou.
export async function retryHealthReport(reportId: string) {
  const { report } = await loadReport(reportId);
  if (!report.reviewedAt && ["falhou", "ia_desligada", "lendo"].includes(report.status)) {
    await prisma.healthReport.update({ where: { id: reportId }, data: { status: "lendo" } });
    await processHealthReport(reportId);
    refresh();
  }
  redirect(reportPath(report.studentId, reportId));
}

// Revisão da equipe: só o que foi marcado entra no estudo de caso. Os valores
// chegam do formulário, mas só valem os que a leitura sugeriu.
export async function reviewHealthReport(reportId: string, formData: FormData) {
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
    const content = mergeIntoCaseStudy(parseCaseStudy(existing?.content), accepted.fields);
    await prisma.caseStudy.upsert({
      where: { studentId },
      create: { studentId, content: JSON.stringify(content), updatedBy: user.name },
      update: { content: JSON.stringify(content), updatedBy: user.name },
    });
    await prisma.accessLog.create({ data: { studentId, actor: user.name, role: user.role, action: existing ? "editou" : "criou", detail: "Estudo de caso: informações do laudo" } });
  }
  await prisma.healthReport.update({ where: { id: reportId }, data: { reviewedBy: user.name, reviewedAt: new Date(), accepted: JSON.stringify(accepted) } });

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

// Exclui o arquivo e a leitura. O que já foi juntado ao estudo de caso fica.
export async function deleteHealthReport(reportId: string) {
  const { report, user } = await loadReport(reportId);
  await prisma.healthReport.delete({ where: { id: reportId } });
  await prisma.accessLog.create({ data: { studentId: report.studentId, actor: user.name, role: user.role, action: "excluiu", detail: "Laudo excluído do estudo de caso" } });
  refresh();
  redirect(`${reportPath(report.studentId)}?excluido=1`);
}
