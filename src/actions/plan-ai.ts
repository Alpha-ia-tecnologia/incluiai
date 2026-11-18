"use server";

import { redirect } from "next/navigation";
import { z } from "zod/v4";
import type { ActionResult } from "@/lib/action-result";
import { formField } from "@/lib/form-data";
import { runAction, runFormAction } from "@/lib/server-action";
import { proposePlan } from "@/lib/plan-proposal";
import { createStudentPlan, discardPlanProposal } from "@/lib/records";
import { planDocumentsFromForm } from "@/lib/plan-documents";

export async function generatePlanDraft(studentId: string): Promise<ActionResult> {
  return runAction(async (user) => {
    await proposePlan(user, studentId);
    redirect(`/estudantes/${studentId}/ppi#proposta`);
  });
}

const activateForm = z.object({ initialSituation: formField.text(), reviewDate: formField.text(10), objetivo: formField.list(4) });

export async function activatePlanDraft(studentId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, activateForm, async (user, data) => {
    await createStudentPlan(user, studentId, {
      initialSituation: data.initialSituation,
      reviewDate: data.reviewDate,
      documents: planDocumentsFromForm((name) => formData.get(name)),
      proposalObjectives: data.objetivo.map(Number),
    });
    redirect(`/estudantes/${studentId}/ppi`);
  });
}

export async function discardPlanDraft(studentId: string): Promise<ActionResult> {
  return runAction((user) => discardPlanProposal(user, studentId));
}
