"use server";

import { z } from "zod/v4";
import type { ActionResult } from "@/lib/action-result";
import { formField } from "@/lib/form-data";
import { runAction, runFormAction } from "@/lib/server-action";
import { addPlanObjective, closeStudentPlan, createStudentPlan, reviewStudentPlan, savePlanDocuments, setObjectiveStatus } from "@/lib/records";
import { planDocumentsFromForm } from "@/lib/plan-documents";

const newPlanForm = z.object({ initialSituation: formField.text(), reviewDate: formField.text(10) });

export async function createPlan(studentId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, newPlanForm, (user, data) =>
    createStudentPlan(user, studentId, { ...data, documents: planDocumentsFromForm((name) => formData.get(name)) }));
}

const objectiveForm = z.object({
  action: formField.text(),
  condition: formField.text(),
  criterion: formField.text(),
  deadlineWeeks: z.coerce.number().int().min(1).max(52).default(6),
  currentSupport: z.coerce.number().int().min(0).max(5).default(2),
  targetSupport: z.coerce.number().int().min(0).max(5).optional(),
  dimension: formField.text(40),
  bnccCode: formField.text(20),
});

export async function createObjective(studentId: string, planId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, objectiveForm, (user, data) =>
    addPlanObjective(user, studentId, planId, {
      ...data,
      dimension: data.dimension || "comunicacao",
      targetSupport: data.targetSupport ?? Math.max(0, data.currentSupport - 1),
    }));
}

export async function markObjectiveStatus(studentId: string, objectiveId: string, status: string): Promise<ActionResult> {
  return runAction(async (user) => {
    await setObjectiveStatus(user, studentId, objectiveId, status);
  });
}

const reviewForm = z.object({ summary: formField.text(), nextReviewDate: formField.text(10) });

export async function reviewPlan(studentId: string, planId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, reviewForm, (user, data) => reviewStudentPlan(user, studentId, planId, data));
}

export async function updatePlanDocuments(studentId: string, planId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runAction((user) => savePlanDocuments(user, studentId, planId, planDocumentsFromForm((name) => formData.get(name))));
}

const closeForm = z.object({ reason: formField.text() });

export async function closePlan(studentId: string, planId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, closeForm, (user, data) => closeStudentPlan(user, studentId, planId, data.reason));
}
