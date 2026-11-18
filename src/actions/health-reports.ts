"use server";

import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/lib/server-action";
import { REPORT_FIELD_KEYS } from "@/lib/health-reports-core";
import { deleteHealthReport, retryHealthReport, reviewHealthReport, uploadHealthReport } from "@/lib/health-reports";
import { healthReportsHref } from "@/lib/search-params";


export async function uploadHealthReportAction(studentId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const report = await uploadHealthReport(user, studentId, formData.get("arquivo"), formData.get("familiaEntregou") === "on");
    redirect(healthReportsHref(studentId, report.id));
  });
}

export async function retryHealthReportAction(reportId: string): Promise<ActionResult> {
  return runAction(async (user) => {
    const { studentId } = await retryHealthReport(user, reportId);
    redirect(healthReportsHref(studentId, reportId));
  });
}

export async function reviewHealthReportAction(reportId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const choice = formData.get("intent") === "descartar" ? null : {
      guidance: formData.getAll("orientacao").map(String),
      fields: Object.fromEntries(REPORT_FIELD_KEYS.map((field) => [field, formData.getAll(`campo:${field}`).map(String)])),
    };
    const { studentId, reviewed } = await reviewHealthReport(user, reportId, choice);
    redirect(healthReportsHref(studentId, reportId, reviewed ? "revisado" : undefined));
  });
}

export async function deleteHealthReportAction(reportId: string): Promise<ActionResult> {
  return runAction(async (user) => {
    const { studentId } = await deleteHealthReport(user, reportId);
    redirect(healthReportsHref(studentId, undefined, "excluido"));
  });
}
