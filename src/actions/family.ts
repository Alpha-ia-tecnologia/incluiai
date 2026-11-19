"use server";

import { z } from "zod/v4";
import type { ActionResult } from "@/lib/action-result";
import { formField } from "@/lib/form-data";
import { runFormAction } from "@/lib/server-action";
import { shareWithSchool } from "@/lib/family-share";

const shareForm = z.object({ answers: formField.list(80), note: formField.text(1000), achievement: formField.text(), author: formField.text(120) });

export async function tellSchool(studentId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, shareForm, (user, data) => shareWithSchool(user, studentId, data));
}
