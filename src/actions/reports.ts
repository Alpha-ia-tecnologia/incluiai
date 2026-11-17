"use server";

import { redirect } from "next/navigation";
import { z } from "zod/v4";
import type { ActionResult } from "@/lib/action-result";
import { formField } from "@/lib/form-data";
import { runAction, runFormAction } from "@/lib/server-action";
import { createReport, deleteDraft, refreshReport, saveOpinion, validateReport } from "@/lib/reports";

const base = (studentId: string) => `/estudantes/${studentId}/relatorios`;

const periodForm = z.object({ start: formField.text(10), end: formField.text(10) });

export async function newReport(studentId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, periodForm, async (user, period) => {
    const report = await createReport(user, studentId, period.start, period.end);
    redirect(`${base(studentId)}/${report.id}`);
  });
}

const opinionForm = z.object({ opinion: z.string().default(""), intent: formField.text(20) });

export async function saveReport(studentId: string, reportId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, opinionForm, async (user, data) => {
    await saveOpinion(user, studentId, reportId, data.opinion);
    if (data.intent === "validar") await validateReport(user, studentId, reportId);
  });
}

export async function refreshReportData(studentId: string, reportId: string): Promise<ActionResult> {
  return runAction((user) => refreshReport(user, studentId, reportId));
}

export async function removeReportDraft(studentId: string, reportId: string): Promise<ActionResult> {
  return runAction(async (user) => {
    await deleteDraft(user, studentId, reportId);
    redirect(base(studentId));
  });
}
