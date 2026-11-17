"use server";

import { z } from "zod/v4";
import type { ActionResult } from "@/lib/action-result";
import { formField } from "@/lib/form-data";
import { runFormAction } from "@/lib/server-action";
import { saveIntersectorReport } from "@/lib/records";

const reportForm = z.object({
  communication: formField.text(),
  accessResources: formField.text(),
  positioning: formField.optionalText(),
  facilitators: formField.text(),
  schoolGuidance: formField.text(),
  strategiesToTry: formField.text(),
  sharedGoals: formField.text(),
});

export async function createIntersectorReport(studentId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, reportForm, async (user, report) => {
    await saveIntersectorReport(user, studentId, report);
  });
}
