"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStudentTeam } from "@/lib/auth";
import { createReport, deleteDraft, refreshReport, saveOpinion, validateReport } from "@/lib/reports";
import { periodProblem } from "@/lib/period-report";

// Relatório do período: a equipe abre o rascunho, o AEE escreve o parecer e
// valida (o AEE ou a coordenação). Regras em src/lib/reports.ts.

export type ReportState = { error?: string; saved?: boolean };

const base = (studentId: string) => `/estudantes/${studentId}/relatorios`;

export async function newReport(studentId: string, _previous: ReportState, formData: FormData): Promise<ReportState> {
  const user = await requireStudentTeam(studentId);
  const start = String(formData.get("start") ?? "");
  const end = String(formData.get("end") ?? "");
  const problem = periodProblem(start, end);
  if (problem) return { error: problem };
  const report = await createReport(user, studentId, start, end);
  revalidatePath(base(studentId));
  redirect(`${base(studentId)}/${report.id}`);
}

// Salvar o parecer ou, com intent=validar, salvar e validar de uma vez.
export async function saveReport(studentId: string, reportId: string, _previous: ReportState, formData: FormData): Promise<ReportState> {
  const user = await requireStudentTeam(studentId);
  await saveOpinion(user, studentId, reportId, String(formData.get("opinion") ?? ""));
  if (formData.get("intent") === "validar") {
    const problem = await validateReport(user, studentId, reportId);
    if (problem) return { error: problem };
    revalidatePath(base(studentId));
    revalidatePath(`/familia/${studentId}`);
    revalidatePath(`${base(studentId)}/${reportId}`);
    return {};
  }
  revalidatePath(`${base(studentId)}/${reportId}`);
  return { saved: true };
}

export async function refreshReportData(studentId: string, reportId: string): Promise<void> {
  const user = await requireStudentTeam(studentId);
  await refreshReport(user, studentId, reportId);
  revalidatePath(`${base(studentId)}/${reportId}`);
}

export async function removeReportDraft(studentId: string, reportId: string): Promise<void> {
  await requireStudentTeam(studentId);
  await deleteDraft(studentId, reportId);
  revalidatePath(base(studentId));
  redirect(base(studentId));
}
